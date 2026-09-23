/**
 * SAM.gov opportunity detail enrichment.
 *
 * Network contract observed in the supplied SAM HAR (2026-09-21):
 *   GET /api/prod/opps/v2/opportunities/:id
 *   GET /api/prod/opps/v2/opportunities/:id/history
 *   GET /api/prod/opps/v3/opportunities/:id/resources
 *   GET /api/prod/federalorganizations/v1/organizations/:organizationId
 *
 * HAR update (2026-09-21): a second capture exposed the public SAM search MFE
 * endpoint used by sam.gov/search:
 *   GET /api/prod/sgs/v1/search/?index=ac&page=0&sort=-modifiedDate&size=25
 *       &mode=search&responseType=json&domain=ac&is_active=true&q=...&qMode=ALL
 *
 * Search is best-effort and treated as procurement discovery evidence only. A
 * candidate is promoted to full SAM detail only after local title/solicitation
 * matching clears a confidence threshold. No browser cookies are replayed.
 */
import { fetchWithTimeout } from "./fetch-with-timeout.ts";

const SAM = "https://sam.gov/api/prod";

export type SamPointOfContact = {
  type: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
};

export type SamAttachment = {
  name: string;
  resource_id: string | null;
  attachment_id: string | null;
  mime_type: string | null;
  size: number | null;
  posted_date: string | null;
  deleted: boolean;
};


export type SamSearchHit = {
  opportunity_id: string;
  title: string | null;
  solicitation_number: string | null;
  notice_type: string | null;
  publish_date: string | null;
  modified_date: string | null;
  response_deadline: string | null;
  response_timezone: string | null;
  is_active: boolean;
  is_canceled: boolean;
  description: string | null;
  agency: string | null;
  office: string | null;
  match_score: number;
  verify_url: string;
};

export type SamSearchContext = {
  query: string;
  found: boolean;
  total_elements: number | null;
  total_pages: number | null;
  page: number;
  hits: SamSearchHit[];
  search_url: string;
  fetched_at: string;
  parser_note?: string;
  error?: string;
};

export type SamOpportunityProfile = {
  opportunity_id: string;
  found: boolean;
  title: string | null;
  solicitation_number: string | null;
  status: string | null;
  posted_date: string | null;
  modified_date: string | null;
  response_deadline: string | null;
  response_timezone: string | null;
  set_aside: string | null;
  naics: string[];
  psc: string | null;
  place_of_performance: string | null;
  description: string | null;
  organization_id: string | null;
  agency: string | null;
  office: string | null;
  points_of_contact: SamPointOfContact[];
  revision_count: number;
  attachments: SamAttachment[];
  verify_url: string;
  fetched_at: string;
  error?: string;
};

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 4 || out.length > 250 || value == null) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out, depth + 1);
  }
}

/** Find a 32/36-char opportunity id from known fields or a SAM URL. */
export function extractSamOpportunityId(...values: unknown[]): string | null {
  const strings: string[] = [];
  for (const value of values) collectStrings(value, strings);

  for (const raw of strings) {
    const direct = raw.trim();
    if (/^[a-f0-9]{32}$/i.test(direct) || /^[a-f0-9-]{36}$/i.test(direct)) return direct;

    const api = direct.match(/\/opportunities\/([a-f0-9-]{32,36})(?:[/?#]|$)/i);
    if (api?.[1]) return api[1];

    const publicUrl = direct.match(/sam\.gov\/opp\/([a-f0-9-]{32,36})(?:[/?#]|$)/i);
    if (publicUrl?.[1]) return publicUrl[1];
  }
  return null;
}

function stripHtml(value: unknown): string | null {
  const html = String(value ?? "").trim();
  if (!html) return null;
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

async function getJson(path: string): Promise<any> {
  // HAR used api_key=null for anonymous public detail requests. Keep the same
  // public contract but do not copy any browser cookies/headers from the HAR.
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetchWithTimeout(`${SAM}${path}${sep}api_key=null`, {
    headers: { Accept: "application/json, application/hal+json" },
  }, 10_000);
  if (!res.ok) throw new Error(`SAM HTTP ${res.status}`);
  return res.json();
}


function normalizeForMatch(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "this", "that", "inc", "llc", "corp", "corporation",
  "company", "co", "project", "services", "service", "construction", "washington", "state", "wa",
]);

function tokenSet(value: unknown): Set<string> {
  return new Set(
    normalizeForMatch(value)
      .split(" ")
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

function overlapScore(query: string, target: string): number {
  const q = tokenSet(query);
  const t = tokenSet(target);
  if (!q.size || !t.size) return 0;
  let n = 0;
  for (const token of q) if (t.has(token)) n += 1;
  return n / q.size;
}

function samMatchScore(query: string, row: any): number {
  const q = normalizeForMatch(query);
  if (!q) return 0;
  const title = normalizeForMatch(row?.title);
  const sol = normalizeForMatch(row?.solicitationNumber);
  const desc = normalizeForMatch(row?.descriptions?.[0]?.content);

  if (sol && sol === q) return 1;
  if (sol && q.length >= 5 && (sol.includes(q) || q.includes(sol))) return 0.98;
  if (title && title === q) return 0.97;
  if (title && q.length >= 8 && (title.includes(q) || q.includes(title))) return 0.92;

  const titleOverlap = overlapScore(query, title);
  const descOverlap = overlapScore(query, desc);
  const fullPhraseInDesc = q.length >= 8 && desc.includes(q);
  return Math.min(0.9, Math.max(titleOverlap * 0.82, descOverlap * 0.58, fullPhraseInDesc ? 0.78 : 0));
}

function hierarchyNames(value: unknown): { agency: string | null; office: string | null } {
  const rows = Array.isArray(value) ? value : [];
  const agencyRow = rows.find((x: any) => /agency|department/i.test(String(x?.type ?? ""))) ?? rows[0];
  const officeRow = [...rows].reverse().find((x: any) => /office|command/i.test(String(x?.type ?? ""))) ?? rows.at(-1);
  return { agency: text(agencyRow?.name), office: text(officeRow?.name) };
}

/** True when the lead already looks federal/SAM-related. Search discovery is gated by this. */
export function isSamContext(...values: unknown[]): boolean {
  const visit = (v: unknown, depth = 0): boolean => {
    if (depth > 3 || v == null) return false;
    if (typeof v === "string") {
      return /sam\.gov|\bsam\b|federal procurement|contract opportunit|solicitation|notice id|\bnaics\b|\buei\b/i.test(v);
    }
    if (Array.isArray(v)) return v.some((x) => visit(x, depth + 1));
    if (typeof v === "object") return Object.entries(v as Record<string, unknown>).some(([k, x]) => visit(k, depth + 1) || visit(x, depth + 1));
    return false;
  };
  return values.some((v) => visit(v));
}

/** Pick the strongest SAM lookup term already present in the lead. */
export function samKeyword(input: {
  name?: string | null;
  company?: string | null;
  permit_number?: string | null;
  permit_data?: Record<string, unknown> | null;
  enrichment_data?: Record<string, unknown> | null;
}): string {
  const pd = input.permit_data ?? {};
  const enr = input.enrichment_data ?? {};
  const keys = [
    pd.solicitation_number,
    pd.solicitationNumber,
    pd.notice_id,
    pd.noticeId,
    pd.project_title,
    pd.project_name,
    pd.title,
    enr.solicitation_number,
    enr.solicitationNumber,
    enr.project_title,
    enr.project_name,
    enr.title,
    input.permit_number,
    input.company,
    input.name,
  ];
  for (const v of keys) {
    const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    if (s.length >= 4) return s.slice(0, 160);
  }
  return "";
}

/**
 * Search the anonymous SAM public UI endpoint observed in the supplied HAR.
 * Results are ranked again locally to avoid treating a broad SAM text result as
 * a verified project match. This endpoint is an observed UI contract, not a
 * promise of long-term API stability, so failures are non-blocking.
 */
export async function searchSamOpportunities(query: string, maxResults = 5): Promise<SamSearchContext> {
  const q = query.replace(/\s+/g, " ").trim();
  const params = new URLSearchParams({
    random: String(Date.now()),
    index: "ac",
    page: "0",
    sort: "-modifiedDate",
    size: "25",
    mode: "search",
    responseType: "json",
    domain: "ac",
    is_active: "true",
    q,
    qMode: "ALL",
  });
  const searchUrl = `${SAM}/sgs/v1/search/?${params.toString()}`;
  const base: SamSearchContext = {
    query: q,
    found: false,
    total_elements: null,
    total_pages: null,
    page: 0,
    hits: [],
    search_url: searchUrl,
    fetched_at: new Date().toISOString(),
  };
  if (!q) return { ...base, parser_note: "No SAM search keyword available." };

  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: { Accept: "application/hal+json, application/json" },
    }, 10_000);
    if (!res.ok) throw new Error(`SAM search HTTP ${res.status}`);
    const payload = await res.json();
    const rows = Array.isArray(payload?._embedded?.results) ? payload._embedded.results : [];
    const hits: SamSearchHit[] = rows
      .filter((row: any) => String(row?._type ?? "").toLowerCase() === "opportunity")
      .map((row: any) => {
        const id = String(row?._id ?? "").trim();
        const hierarchy = hierarchyNames(row?.organizationHierarchy);
        return {
          opportunity_id: id,
          title: text(row?.title),
          solicitation_number: text(row?.solicitationNumber),
          notice_type: text(row?.type?.value ?? row?.type?.code),
          publish_date: text(row?.publishDate),
          modified_date: text(row?.modifiedDate),
          response_deadline: text(row?.responseDateActual ?? row?.responseDate),
          response_timezone: text(row?.responseTimeZone),
          is_active: row?.isActive === true,
          is_canceled: row?.isCanceled === true,
          description: stripHtml(row?.descriptions?.[0]?.content),
          agency: hierarchy.agency,
          office: hierarchy.office,
          match_score: samMatchScore(q, row),
          verify_url: id ? `https://sam.gov/opp/${encodeURIComponent(id)}/view` : "https://sam.gov/search/",
        };
      })
      .filter((hit: SamSearchHit) => Boolean(hit.opportunity_id))
      .sort((a: SamSearchHit, b: SamSearchHit) => b.match_score - a.match_score)
      .slice(0, Math.max(1, Math.min(maxResults, 10)));

    return {
      ...base,
      found: hits.length > 0,
      total_elements: Number.isFinite(Number(payload?.page?.totalElements)) ? Number(payload.page.totalElements) : null,
      total_pages: Number.isFinite(Number(payload?.page?.totalPages)) ? Number(payload.page.totalPages) : null,
      page: Number.isFinite(Number(payload?.page?.number)) ? Number(payload.page.number) : 0,
      hits,
      fetched_at: new Date().toISOString(),
      ...(hits.length ? {} : { parser_note: "SAM search responded, but no opportunity results were parsed." }),
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      parser_note: "SAM search is best-effort and must never block owner enrichment.",
      fetched_at: new Date().toISOString(),
    };
  }
}

export function bestSamSearchHit(search: SamSearchContext, minScore = 0.52): SamSearchHit | null {
  const hit = search.hits[0] ?? null;
  if (!hit || hit.is_canceled || !hit.is_active || hit.match_score < minScore) return null;
  return hit;
}

export async function fetchSamOpportunity(opportunityId: string): Promise<SamOpportunityProfile> {
  const id = opportunityId.trim();
  const base: SamOpportunityProfile = {
    opportunity_id: id,
    found: false,
    title: null,
    solicitation_number: null,
    status: null,
    posted_date: null,
    modified_date: null,
    response_deadline: null,
    response_timezone: null,
    set_aside: null,
    naics: [],
    psc: null,
    place_of_performance: null,
    description: null,
    organization_id: null,
    agency: null,
    office: null,
    points_of_contact: [],
    revision_count: 0,
    attachments: [],
    verify_url: `https://sam.gov/opp/${encodeURIComponent(id)}/view`,
    fetched_at: new Date().toISOString(),
  };
  if (!id) return base;

  try {
    const detail = await getJson(`/opps/v2/opportunities/${encodeURIComponent(id)}`);
    const d = detail?.data2 ?? {};
    const orgId = text(d.organizationId);

    const [history, resources, org] = await Promise.all([
      getJson(`/opps/v2/opportunities/${encodeURIComponent(id)}/history`).catch(() => null),
      getJson(`/opps/v3/opportunities/${encodeURIComponent(id)}/resources?excludeDeleted=false&withScanResult=false`).catch(() => null),
      orgId
        ? getJson(`/federalorganizations/v1/organizations/${encodeURIComponent(orgId)}`).catch(() => null)
        : Promise.resolve(null),
    ]);

    const naics = (Array.isArray(d.naics) ? d.naics : [])
      .flatMap((n: any) => (Array.isArray(n?.code) ? n.code : [n?.code]))
      .map((v: unknown) => String(v ?? "").trim())
      .filter(Boolean);

    const pop = d.placeOfPerformance ?? {};
    const popParts = [pop?.city?.name, pop?.state?.name ?? pop?.state?.code, pop?.country?.name]
      .map((v) => text(v))
      .filter(Boolean);

    const descriptions = (Array.isArray(detail?.description) ? detail.description : [])
      .map((x: any) => stripHtml(x?.body))
      .filter(Boolean);

    const contacts: SamPointOfContact[] = (Array.isArray(d.pointOfContact) ? d.pointOfContact : [])
      .map((p: any) => ({
        type: text(p?.type),
        name: text(p?.fullName),
        email: text(p?.email),
        phone: text(p?.phone),
      }))
      .filter((p: SamPointOfContact) => p.name || p.email || p.phone);

    const embedded = resources?._embedded?.opportunityAttachmentList;
    const attachments: SamAttachment[] = (Array.isArray(embedded) ? embedded : [])
      .flatMap((group: any) => (Array.isArray(group?.attachments) ? group.attachments : []))
      .map((a: any) => ({
        name: String(a?.name ?? "Attachment").trim(),
        resource_id: text(a?.resourceId),
        attachment_id: text(a?.attachmentId),
        mime_type: text(a?.mimeType),
        size: typeof a?.size === "number" ? a.size : Number(a?.size) || null,
        posted_date: text(a?.postedDate),
        deleted: String(a?.deletedFlag ?? "0") === "1",
      }))
      .filter((a: SamAttachment) => !a.deleted);

    const orgRow = Array.isArray(org?._embedded) ? org._embedded[0]?.org : null;

    return {
      ...base,
      found: true,
      title: text(d.title),
      solicitation_number: text(d.solicitationNumber),
      status: text(detail?.status?.value ?? detail?.status?.code),
      posted_date: text(detail?.postedDate),
      modified_date: text(detail?.modifiedDate),
      response_deadline: text(d?.solicitation?.deadlines?.response),
      response_timezone: text(d?.solicitation?.deadlines?.responseTz),
      set_aside: text(d?.solicitation?.setAside),
      naics: Array.from(new Set(naics)),
      psc: text(d.classificationCode),
      place_of_performance: popParts.join(", ") || null,
      description: descriptions.join(" ") || null,
      organization_id: orgId,
      agency: text(orgRow?.agencyName ?? orgRow?.l1Name),
      office: text(orgRow?.name ?? orgRow?.l3Name),
      points_of_contact: contacts,
      revision_count: Array.isArray(history?.history) ? history.history.length : 0,
      attachments,
      fetched_at: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error),
      fetched_at: new Date().toISOString(),
    };
  }
}
