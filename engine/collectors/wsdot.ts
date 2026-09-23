/**
 * WSDOT project context.
 *
 * HAR observations (2026-09-21):
 * - Search results are server-rendered by the public Drupal Search projects page.
 * - Project detail pages are also server-rendered HTML; the supplied HARs did
 *   not expose a dedicated project JSON/XHR endpoint.
 * - The detail HTML reliably exposes Timeline, Project status, Funding, the
 *   overview, funding narrative, milestones and contact information.
 *
 * WSDOT is PROJECT evidence, not owner evidence. Nothing in this module should
 * increase Owner Intelligence confidence.
 */
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

const SEARCH = "https://wsdot.wa.gov/construction-planning/search-projects";

export type WsdotProjectContact = {
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type WsdotProjectHit = {
  title: string;
  url: string;
  timeline: string | null;
  status: "Not started" | "Pre-construction" | "Construction" | "Completed" | null;
  counties: string[];
  summary: string | null;
  overview?: string | null;
  funding?: string | null;
  funding_detail?: string | null;
  milestones?: string[];
  contact?: WsdotProjectContact | null;
  modified_at?: string | null;
  detail_verified?: boolean;
};

export type WsdotProjectContext = {
  query: string;
  found: boolean;
  search_url: string;
  projects: WsdotProjectHit[];
  fetched_at: string;
  parser_note?: string;
  error?: string;
};

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

function plain(html: string): string {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/div>|<\/h\d>|<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cleanText(s: string | null | undefined, max = 2_000): string | null {
  const out = (s ?? "").replace(/\s+/g, " ").trim();
  if (!out) return null;
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}

function absoluteUrl(href: string): string {
  try {
    return new URL(decodeHtml(href), SEARCH).toString();
  } catch {
    return href;
  }
}

function normalizeStatus(value: string | null | undefined): WsdotProjectHit["status"] {
  const s = (value ?? "").trim().toLowerCase();
  if (s === "not started") return "Not started";
  if (s === "pre-construction" || s === "preconstruction") return "Pre-construction";
  if (s === "construction") return "Construction";
  if (s === "completed" || s === "complete") return "Completed";
  return null;
}

const WA_COUNTIES = [
  "Adams", "Asotin", "Benton", "Chelan", "Clallam", "Clark", "Columbia", "Cowlitz", "Douglas", "Ferry",
  "Franklin", "Garfield", "Grant", "Grays Harbor", "Island", "Jefferson", "King", "Kitsap", "Kittitas", "Klickitat",
  "Lewis", "Lincoln", "Mason", "Okanogan", "Pacific", "Pend Oreille", "Pierce", "San Juan", "Skagit", "Skamania",
  "Snohomish", "Spokane", "Stevens", "Thurston", "Wahkiakum", "Walla Walla", "Whatcom", "Whitman", "Yakima",
] as const;

function countiesFromText(text: string): string[] {
  const found = new Set<string>();

  for (const county of WA_COUNTIES) {
    const escaped = county.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\s+County\\b`, "i").test(text)) found.add(`${county} County`);
  }

  // WSDOT commonly writes lists like "King, Snohomish and Whatcom counties".
  // Parse only the text immediately preceding "counties" so road names such
  // as "South Spokane Street" cannot become false county matches.
  for (const match of text.matchAll(/(?:^|[\n.:;])\s*([A-Za-z .,'&-]{2,120}?)\s+counties\b/gi)) {
    const segment = match[1] ?? "";
    for (const county of WA_COUNTIES) {
      const escaped = county.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[,/&]|\\band\\b)\\s*${escaped}\\s*(?=$|[,/&]|\\band\\b)`, "i").test(segment)) {
        found.add(`${county} County`);
      }
    }
  }

  return Array.from(found).slice(0, 12);
}

function fieldPair(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = html.match(
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*\\bcol-1\\b[^"']*["'][^>]*>\\s*${escaped}\\s*<\\/div>\\s*<div\\b[^>]*class=["'][^"']*\\bcol-2\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      "i",
    ),
  );
  return m ? cleanText(plain(m[1]), 500) : null;
}

function tabPane(html: string, id: string): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startRe = new RegExp(`<div\\b(?=[^>]*\\bid=["']${escaped}["'])(?=[^>]*\\bclass=["'][^"']*\\btab-pane\\b[^"']*["'])[^>]*>`, "i");
  const start = startRe.exec(html);
  if (!start || start.index == null) return null;
  const bodyStart = start.index + start[0].length;
  const remainder = html.slice(bodyStart);
  const next = /<div\b(?=[^>]*\bid=["'][^"']+["'])(?=[^>]*\bclass=["'][^"']*\btab-pane\b[^"']*["'])[^>]*>/i.exec(remainder);
  return next && next.index != null ? remainder.slice(0, next.index) : remainder;
}

function extractOverview(html: string): string | null {
  const m = html.match(/<h2\b[^>]*>\s*Project overview\s*<\/h2>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\bcol-1\b[^"']*["'][^>]*>\s*Timeline\s*<\/div>|<h2\b[^>]*>\s*What to expect\s*<\/h2>)/i);
  return m ? cleanText(plain(m[1]), 1_800) : null;
}

function extractMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return decodeHtml(m[1]).trim() || null;
  }
  return null;
}

function extractContact(html: string): WsdotProjectContact | null {
  const pane = tabPane(html, "Contact") ?? html.match(/id=["']Contact["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  if (!pane) return null;
  const text = plain(pane);
  const email = pane.match(/mailto:([^"'<>\s]+)/i)?.[1] ?? text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ?? null;
  const phone = text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/)?.[0] ?? null;
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const name = lines.find((x) => !/wsdot|communications?|@|\d{3}[-.\s]/i.test(x) && x.length <= 90) ?? null;
  const role = lines.find((x) => /wsdot|communications?|engineer|manager|project/i.test(x) && !/@/i.test(x)) ?? null;
  if (!name && !role && !phone && !email) return null;
  return { name, role, phone, email };
}

function extractMilestones(html: string): string[] {
  const pane = tabPane(html, "Timeline");
  if (!pane) return [];
  const text = plain(pane);
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    if (/^Milestone$/i.test(current)) continue;
    if (/^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Spring|Summer|Fall|Winter)\b/i.test(current)) {
      const next = lines[i + 1] && !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Spring|Summer|Fall|Winter)\b/i.test(lines[i + 1]) ? lines[++i] : "";
      out.push(cleanText(`${current}${next ? ` — ${next}` : ""}`, 300) ?? current);
    }
  }
  return out.slice(0, 12);
}

export function parseWsdotProjectDetail(html: string, url: string): WsdotProjectHit | null {
  const title = cleanText(plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""), 500);
  if (!title) return null;

  const overview = extractOverview(html);
  const timeline = fieldPair(html, "Timeline");
  const status = normalizeStatus(fieldPair(html, "Project status"));
  const funding = fieldPair(html, "Funding");
  const fundingPane = tabPane(html, "Funding");
  const fundingDetail = fundingPane ? cleanText(plain(fundingPane), 1_200) : null;
  const metaDescription = extractMeta(html, "description");
  const modifiedAt = extractMeta(html, "dcterms.modified");
  const combined = [title, overview, metaDescription, plain(tabPane(html, "History") ?? "")].filter(Boolean).join(" ");

  return {
    title,
    url,
    timeline,
    status,
    counties: countiesFromText(combined),
    summary: metaDescription ?? overview,
    overview,
    funding,
    funding_detail: fundingDetail,
    milestones: extractMilestones(html),
    contact: extractContact(html),
    modified_at: modifiedAt,
    detail_verified: true,
  };
}

function parseCard(block: string): WsdotProjectHit | null {
  const anchors = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const candidate = anchors
    .map((m) => ({ href: m[1], title: plain(m[2]) }))
    .find((a) =>
      a.title.length >= 8 &&
      /\/construction-planning\/search-projects\//i.test(a.href) &&
      !/[?&]page=|#|\/search-projects\/?$/i.test(a.href),
    );
  if (!candidate) return null;

  const body = plain(block);
  const timeline = body.match(/Timeline:?\s*([^\n]{3,180})/i)?.[1]?.trim() ?? null;
  const statusMatch = body.match(/\b(Not started|Pre-construction|Construction|Completed)\b/i)?.[1];
  const status = normalizeStatus(statusMatch);
  const counties = countiesFromText(body);

  let summary = body;
  const titleIndex = summary.toLowerCase().indexOf(candidate.title.toLowerCase());
  if (titleIndex >= 0) summary = summary.slice(titleIndex + candidate.title.length);
  summary = summary
    .replace(/Timeline:?\s*[^\n]{3,180}/i, " ")
    .replace(/\b(Not started|Pre-construction|Construction|Completed)\b/gi, " ")
    .replace(/\b[A-Z][A-Za-z .'-]{1,30} County\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (summary.length > 650) summary = `${summary.slice(0, 647)}…`;

  return {
    title: candidate.title,
    url: absoluteUrl(candidate.href),
    timeline,
    status,
    counties,
    summary: summary || null,
    detail_verified: false,
  };
}

export function isWsdotContext(...values: unknown[]): boolean {
  const visit = (v: unknown, depth = 0): boolean => {
    if (depth > 3 || v == null) return false;
    if (typeof v === "string") return /\bwsdot\b|wsdot\.wa\.gov/i.test(v);
    if (Array.isArray(v)) return v.some((x) => visit(x, depth + 1));
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).some((x) => visit(x, depth + 1));
    return false;
  };
  return values.some((v) => visit(v));
}

export function wsdotKeyword(input: {
  name?: string | null;
  company?: string | null;
  permit_data?: Record<string, unknown> | null;
  enrichment_data?: Record<string, unknown> | null;
}): string {
  const pd = input.permit_data ?? {};
  const enr = input.enrichment_data ?? {};
  const keys = [
    pd.project_title,
    pd.title,
    pd.project_name,
    pd.description,
    enr.project_title,
    enr.title,
    enr.project_name,
    input.company,
    input.name,
  ];
  for (const v of keys) {
    const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (s.length >= 4) return s.slice(0, 120);
  }
  return "";
}

async function fetchWsdotProjectDetail(hit: WsdotProjectHit): Promise<WsdotProjectHit> {
  try {
    const res = await fetchWithTimeout(hit.url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; ALKAN-Owner-Intelligence/1.0; +https://alkanassistant.com)",
      },
    }, 12_000);
    if (!res.ok) return hit;
    const html = await res.text();
    const detail = parseWsdotProjectDetail(html, hit.url);
    if (!detail) return hit;
    return {
      ...hit,
      ...detail,
      // Preserve card-derived values when the detail page omits them.
      timeline: detail.timeline ?? hit.timeline,
      status: detail.status ?? hit.status,
      counties: detail.counties.length ? detail.counties : hit.counties,
      summary: detail.summary ?? hit.summary,
    };
  } catch {
    return hit;
  }
}

export async function searchWsdotProjects(query: string, maxResults = 5): Promise<WsdotProjectContext> {
  const q = query.replace(/\s+/g, " ").trim();
  const params = new URLSearchParams();
  params.set("combine", q);
  // Public page filter ids observed in WSDOT search URLs for active/future work:
  // Not started + Construction + Pre-construction. Completed is omitted.
  params.append("field_project_status_target_id[94]", "94");
  params.append("field_project_status_target_id[95]", "95");
  params.append("field_project_status_target_id[96]", "96");
  params.set("page", "0");
  const searchUrl = `${SEARCH}?${params.toString()}`;
  const base: WsdotProjectContext = {
    query: q,
    found: false,
    search_url: searchUrl,
    projects: [],
    fetched_at: new Date().toISOString(),
  };
  if (!q) return { ...base, parser_note: "No project keyword available." };

  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; ALKAN-Owner-Intelligence/1.0; +https://alkanassistant.com)",
      },
    }, 12_000);
    if (!res.ok) throw new Error(`WSDOT HTTP ${res.status}`);
    const html = await res.text();

    // Drupal Views renders each result inside a views-row. Keep a second
    // fallback based on project links because WSDOT can change class names.
    const blocks = html.split(/class=["'][^"']*\bviews-row\b[^"']*["']/i).slice(1);
    const hits: WsdotProjectHit[] = [];
    for (const block of blocks) {
      const hit = parseCard(block.slice(0, 12_000));
      if (hit && !hits.some((x) => x.url === hit.url)) hits.push(hit);
      if (hits.length >= maxResults) break;
    }

    if (!hits.length) {
      const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/construction-planning\/search-projects\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
      for (const m of anchors) {
        const title = plain(m[2]);
        if (title.length < 8) continue;
        const start = Math.max(0, (m.index ?? 0) - 1000);
        const block = html.slice(start, Math.min(html.length, (m.index ?? 0) + 6500));
        const hit = parseCard(block) ?? { title, url: absoluteUrl(m[1]), timeline: null, status: null, counties: [], summary: null, detail_verified: false };
        if (!hits.some((x) => x.url === hit.url)) hits.push(hit);
        if (hits.length >= maxResults) break;
      }
    }

    // The new HARs show useful project-level fields are embedded in each
    // server-rendered detail page. Enrich discovered cards in parallel.
    const detailed = hits.length
      ? await Promise.all(hits.slice(0, maxResults).map((hit) => fetchWsdotProjectDetail(hit)))
      : [];

    return {
      ...base,
      found: detailed.length > 0,
      projects: detailed,
      fetched_at: new Date().toISOString(),
      ...(detailed.length
        ? { parser_note: "WSDOT search + project detail parsed from server-rendered HTML; no dedicated project JSON/XHR endpoint was observed in supplied HARs." }
        : { parser_note: "WSDOT responded, but no project card could be parsed. Keep search_url for manual verification." }),
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      parser_note: "WSDOT search is server-rendered and best-effort; a fetch/parser failure must not block owner enrichment.",
      fetched_at: new Date().toISOString(),
    };
  }
}
