import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useConsole, SECTION_META } from "./console-context";

export function Topbar() {
  const qc = useQueryClient();
  const { section, search, setSearch, lastUpdated, setLastUpdated } = useConsole();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["intel"] }),
        qc.invalidateQueries({ queryKey: ["leads"] }),
        qc.invalidateQueries({ queryKey: ["private-market"] }),
        qc.invalidateQueries({ queryKey: ["financing-cases"] }),
      ]);
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface-1/95 px-3 shadow-[0_1px_0_rgba(10,16,36,0.02)] backdrop-blur md:px-5">
      <SidebarTrigger className="shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {SECTION_META[section].title}
        </p>
        <p className="hidden truncate text-[0.63rem] text-muted-foreground lg:block">
          {SECTION_META[section].subtitle}
        </p>
      </div>

      <div className="relative hidden w-64 shrink-0 sm:block lg:w-80">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            section === "project_intelligence"
              ? "Search owner, address, permit…"
              : section === "deal_pipeline" || section === "portfolio"
                ? "Search company, owner, status…"
                : "Search company, city, license…"
          }
          className="h-9 border-border bg-white/80 pl-8 shadow-none"
          aria-label="Global search"
        />
      </div>

      <div className="hidden shrink-0 text-right text-[0.65rem] leading-tight text-muted-foreground md:block">
        <p className="uppercase tracking-[0.18em]">Last updated</p>
        <p className="tabular-nums text-foreground/80">
          {lastUpdated
            ? lastUpdated.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "—"}
        </p>
      </div>

      <Button size="sm" onClick={refresh} disabled={refreshing} className="shrink-0">
        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">
          {section === "project_intelligence" ? "Refresh" : "Refresh"}
        </span>
      </Button>
    </header>
  );
}
