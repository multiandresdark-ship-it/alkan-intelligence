import { useEffect, useState } from "react";

import {
  BarChart3,
  Radar,
  Building2,
  LogOut,
  Landmark,
  Sparkles,
  WalletCards,
  ClipboardCheck,
  Workflow,
  History,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useConsole, type ConsoleSection } from "./console-context";

type NavItem = {
  id: ConsoleSection;
  label: string;
  detail: string;
  code: string;
  icon: typeof BarChart3;
};

const PARTNER_NAV: NavItem[] = [
  {id:"follow_up",label:"Follow-up Desk",detail:"Existing clients · callbacks",code:"00",icon:ClipboardCheck},
  {
    id: "funding_radar",
    label: "Funding Radar",
    detail: "Who to qualify · why now",
    code: "01",
    icon: WalletCards,
  },
  {
    id: "qualification",
    label: "Qualification Queue",
    detail: "Calls · gaps · follow-up",
    code: "02",
    icon: ClipboardCheck,
  },
  {
    id: "business_intelligence",
    label: "Business Intelligence",
    detail: "Company · activity · evidence",
    code: "03",
    icon: Building2,
  },
  {
    id: "deal_pipeline",
    label: "Deal Pipeline",
    detail: "Qualified · submitted · funded",
    code: "04",
    icon: Workflow,
  },
  {
    id: "portfolio",
    label: "Portfolio",
    detail: "Funded · repeat opportunity",
    code: "05",
    icon: History,
  },
];

const ADVANCED_NAV: NavItem[] = [
  {id:"apify",label:"Actor Connections",detail:"Apify · review · import",code:"A0",icon:Workflow},
  {
    id: "project_intelligence",
    label: "Project / Owner Evidence",
    detail: "Projects · owners · timing",
    code: "A1",
    icon: Landmark,
  },
  {
    id: "market_analytics",
    label: "Market Analytics",
    detail: "Scoring · source intelligence",
    code: "A2",
    icon: Radar,
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const { section, setSection } = useConsole();

  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.hash = "";
  }

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const active = section === item.id;
      return (
        <SidebarMenuItem key={item.id}>
          <SidebarMenuButton
            isActive={active}
            tooltip={`${item.label} · ${item.detail}`}
            onClick={() => {
              setSection(item.id);
              if (isMobile) setOpenMobile(false);
            }}
            className={
              active
                ? "min-h-11 border-l-[3px] border-sidebar-primary bg-sidebar-primary/15 text-sidebar-primary hover:bg-sidebar-primary/20 hover:text-sidebar-primary"
                : "min-h-11 border-l-[3px] border-transparent text-sidebar-foreground/68 hover:bg-white/[0.05] hover:text-sidebar-foreground"
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-[0.78rem] font-medium">{item.label}</div>
                <div
                  className={`truncate text-[0.56rem] ${active ? "text-sidebar-primary/70" : "text-sidebar-foreground/35"}`}
                >
                  {item.detail}
                </div>
              </div>
            )}
            {!collapsed && (
              <span className="font-mono text-[0.52rem] tracking-[0.08em] text-sidebar-foreground/28">
                {item.code}
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="border-b border-sidebar-border px-3 py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/95 ring-1 ring-white/20">
            <div className="grid h-6 w-6 place-items-center rounded-[4px] bg-[var(--alkan-blue)] text-[0.58rem] font-bold tracking-[-0.06em] text-white">
              A
            </div>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[0.58rem] font-medium uppercase tracking-[0.24em] text-sidebar-primary">
                ALKAN
              </p>
              <p className="mt-0.5 truncate font-display text-[1.23rem] font-semibold leading-none text-sidebar-foreground">
                Financing Intelligence
              </p>
              <p className="mt-1 truncate text-[0.55rem] uppercase tracking-[0.14em] text-sidebar-foreground/45">
                Partner opportunity console
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup className="pt-4">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[0.56rem] uppercase tracking-[0.18em] text-sidebar-foreground/35">
              Financing workflow
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{renderItems(PARTNER_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-2">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[0.56rem] uppercase tracking-[0.18em] text-sidebar-foreground/35">
              Evidence / advanced
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{renderItems(ADVANCED_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mx-3 mt-auto rounded-md border border-sidebar-primary/20 bg-sidebar-primary/[0.07] p-3">
            <div className="flex items-center gap-2 text-sidebar-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[0.58rem] font-semibold uppercase tracking-[0.14em]">
                Partner view
              </span>
            </div>
            <p className="mt-2 text-[0.64rem] leading-5 text-sidebar-foreground/50">
              ALKAN finds and qualifies the opportunity. Funding decisions remain with the financing partner.
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-sidebar p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-[0.62rem] font-semibold uppercase text-sidebar-foreground ring-1 ring-white/10">
                {(email || "A").slice(0, 2)}
              </div>
              {!collapsed && (
                <p className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground/45">
                  {email || "Active session"}
                </p>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={signOut}
              className="text-sidebar-foreground/45 hover:bg-white/[0.05] hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
