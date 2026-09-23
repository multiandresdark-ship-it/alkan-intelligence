import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ConsoleSection =
  | "apify"
  | "follow_up"
  | "funding_radar"
  | "qualification"
  | "business_intelligence"
  | "deal_pipeline"
  | "portfolio"
  | "project_intelligence"
  | "market_analytics";

type ConsoleContextValue = {
  section: ConsoleSection;
  setSection: (s: ConsoleSection) => void;
  search: string;
  setSearch: (s: string) => void;
  lastUpdated: Date | null;
  setLastUpdated: (d: Date) => void;
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<ConsoleSection>("funding_radar");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const value = useMemo(
    () => ({ section, setSection, search, setSearch, lastUpdated, setLastUpdated }),
    [section, search, lastUpdated],
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used within ConsoleProvider");
  return ctx;
}

export const SECTION_META: Record<ConsoleSection, { title: string; subtitle: string }> = {
  apify: {title:"Actor Connections",subtitle:"Apify runs, source evidence and import history."},
  follow_up: {title:"Follow-up Desk",subtitle:"Existing partner contacts, callbacks and relationship continuity."},
  funding_radar: {
    title: "Funding Radar",
    subtitle: "Active contractors prioritized for a real financing qualification conversation.",
  },
  qualification: {
    title: "Qualification Queue",
    subtitle: "Turn public signals into confirmed capital needs, borrower facts and next actions.",
  },
  business_intelligence: {
    title: "Business Intelligence",
    subtitle: "Company, owner, legal standing, activity, evidence and financing signals.",
  },
  deal_pipeline: {
    title: "Deal Pipeline",
    subtitle: "Qualified opportunities moving from first contact to partner review and funding.",
  },
  portfolio: {
    title: "Portfolio",
    subtitle: "Funded relationships, repeat-opportunity timing and documented outcomes.",
  },
  project_intelligence: {
    title: "Project & Owner Evidence",
    subtitle: "Active projects, resolved owners, decision-makers, timing and source evidence.",
  },
  market_analytics: {
    title: "Market Analytics",
    subtitle: "Underlying contractor and opportunity intelligence across the ALKAN dataset.",
  },
};
