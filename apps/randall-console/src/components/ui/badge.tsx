import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide leading-none transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-border bg-surface-2 text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        tierSPlus: "border-transparent bg-tier-sp text-tier-sp-foreground",
        tierS: "border-transparent bg-tier-s text-tier-s-foreground",
        tierA: "border-transparent bg-tier-a text-tier-a-foreground",
        tierB: "border-transparent bg-tier-b text-tier-b-foreground",
        riskOk: "border-risk-ok/40 bg-risk-ok/15 text-risk-ok",
        riskWarn: "border-risk-warn/40 bg-risk-warn/15 text-risk-warn",
        riskCritical: "border-risk-critical/50 bg-risk-critical/18 text-risk-critical",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
