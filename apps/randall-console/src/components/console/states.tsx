// src/components/console/states.tsx
// Estados compartidos de la consola: skeletons con la forma real, vacío ilustrado y error discreto.
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Skeleton con la silueta exacta de una stat card del dashboard. */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface-1 p-3">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3.5 w-3.5 rounded-sm" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-2 h-2.5 w-24" />
    </div>
  );
}

/** Fila completa de KPIs. */
export function KpiRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Bloque ancho tipo "Distribución por tier". */
export function WideCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-surface-1 p-4", className)}>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-3 w-full rounded-full" />
      <div className="mt-4 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
    </div>
  );
}

/**
 * Filas de tabla con el ancho real de cada columna.
 * `widths` son clases tailwind por columna (mismo orden que el header).
 */
export function TableRowsSkeleton({ rows = 8, widths }: { rows?: number; widths: string[] }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="hover:bg-transparent">
          {widths.map((w, c) => (
            <TableCell key={c} className="py-2">
              <Skeleton className={cn("h-3.5", w)} style={{ opacity: 1 - r * 0.07 }} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Estado vacío ilustrado con copy accionable. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="relative">
        {/* Ilustración: rejilla de radar con el ícono al centro */}
        <div className="absolute inset-0 -m-6 rounded-full border border-border/70" />
        <div className="absolute inset-0 -m-3 rounded-full border border-border" />
        <div className="relative rounded-full border border-primary/40 bg-primary/10 p-4">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Banner de error discreto con reintento. */
export function ErrorBanner({
  title = "Could not load information",
  error,
  onRetry,
  isRetrying,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : undefined;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-md border border-risk-critical/40 bg-risk-critical/8 px-3 py-2",
        className,
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-risk-critical" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-risk-critical">{title}</p>
        {message && (
          <p className="truncate text-[11px] text-muted-foreground" title={message}>
            {message}
          </p>
        )}
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" className="h-7" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isRetrying && "animate-spin")} />
          Retry
        </Button>
      )}
    </div>
  );
}
