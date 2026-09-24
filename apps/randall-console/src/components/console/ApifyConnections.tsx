import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Actor = { actor_id: string; kind: string; label: string };
type Run = {
  id: string;
  actor_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
};
type Preview = {
  run: Run;
  offset: number;
  next_offset: number | null;
  total_items: number;
  page_items: number;
  records: {
    index: number;
    title: string | null;
    permit_number: string | null;
    source_url: string | null;
    observed_at: string | null;
    skip: string | null;
  }[];
  notice: string;
};

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT", "TIMED_OUT"]);

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("Sign in again.");
  const { data, error } = await supabase.functions.invoke("apify-bridge", {
    body,
    headers: { Authorization: "Bearer " + session.session.access_token },
  });
  if (error) {
    let message = error.message;
    try {
      const payload = await (error as any).context?.json();
      message = payload?.error ?? message;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function actorHelp(kind: string) {
  if (kind === "wa_enrichment") return "Washington public records · identity, L&I, compliance and activity evidence";
  if (kind === "accela") return "Legacy extraction · document review required";
  if (kind === "digital") return "Website evidence · qualification stays separate";
  return "Evidence source · qualification stays separate";
}

export function ApifyConnections() {
  const qc = useQueryClient();
  const [actorId, setActorId] = useState("");
  const [runId, setRunId] = useState("");
  const [activeRunId, setActiveRunId] = useState("");
  const [profilesJson, setProfilesJson] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Record<string, number> | null>(null);

  const connections = useQuery({
    queryKey: ["apify-connections"],
    queryFn: () => call<{ configured: boolean; actors: Actor[] }>({ action: "connections" }),
    retry: false,
  });

  const runs = useQuery({
    queryKey: ["apify-runs", actorId],
    queryFn: () => call<{ runs: Run[] }>({ action: "runs", actor_id: actorId }),
    enabled: Boolean(actorId && connections.data?.configured),
    retry: false,
    refetchInterval: activeRunId ? 5000 : false,
  });

  const selected = connections.data?.actors.find((actor) => actor.actor_id === actorId);
  const activeRun = useMemo(
    () => runs.data?.runs.find((run) => run.id === activeRunId) ?? null,
    [activeRunId, runs.data?.runs],
  );

  useEffect(() => {
    if (!activeRunId || !activeRun || !TERMINAL.has(activeRun.status)) return;
    setActiveRunId("");
    setRunId(activeRun.id);
    if (activeRun.status === "SUCCEEDED") {
      toast.success("Washington enrichment finished", {
        description: "Preview the public-record evidence before importing it.",
      });
    } else {
      toast.error("Washington enrichment did not finish successfully", {
        description: activeRun.status,
      });
    }
  }, [activeRun, activeRunId]);

  async function startEnrichment() {
    if (!selected || selected.kind !== "wa_enrichment") return;
    setBusy(true);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const parsed = JSON.parse(profilesJson);
      const profiles = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as any).profiles)
          ? (parsed as any).profiles
          : null;
      if (!profiles) throw new Error("Paste a JSON array of profiles, or an object containing profiles[].");
      if (profiles.length < 1 || profiles.length > 200) throw new Error("Use between 1 and 200 profiles.");

      const started = await call<{ run: Run; input_count: number; notice: string }>({
        action: "start",
        actor_id: selected.actor_id,
        profiles,
      });
      setRunId(started.run.id);
      setActiveRunId(started.run.id);
      toast.success("Washington enrichment started", {
        description: String(started.input_count) + " profiles sent to Apify.",
      });
      await runs.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function inspect(offset = 0) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setPreview(await call<Preview>({ action: "preview", run_id: runId, offset }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function importPage() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const r = await call<{ counts: Record<string, number> }>({
        action: "import",
        run_id: runId,
        offset: preview.offset,
      });
      setResult(r.counts);
      await qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Actor results imported as source evidence.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-border bg-surface-1 p-6">
        <p className="text-xs uppercase tracking-[.2em] text-primary">Source operations</p>
        <h1 className="mt-3 font-display text-4xl">Connect the work already done.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Start the Washington public-record enrichment actor, review completed Apify runs and
          bring their evidence into this workspace. Public records do not establish borrower need.
        </p>
      </header>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Connected actors</h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            void connections.refetch();
            if (actorId) void runs.refetch();
          }}
        >
          Refresh connections
        </Button>
      </div>

      {connections.isPending && <p role="status">Checking actor connections…</p>}
      {connections.isError && (
        <p role="alert" className="text-destructive">
          {connections.error.message}
        </p>
      )}
      {connections.data && !connections.data.configured && (
        <div role="alert" className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          The backend needs its Apify connection key. Ask your ALKAN administrator to finish the
          connection, then refresh.
        </div>
      )}
      {connections.data?.actors.length === 0 && <p>No actors are assigned to this workspace.</p>}

      <div className="grid gap-3 lg:grid-cols-3">
        {connections.data?.actors.map((actor) => (
          <button
            key={actor.actor_id}
            disabled={busy}
            onClick={() => {
              setActorId(actor.actor_id);
              setRunId("");
              setActiveRunId("");
              setPreview(null);
              setResult(null);
              setError("");
            }}
            className={
              "rounded-lg border bg-surface-1 p-5 text-left " +
              (actor.actor_id === actorId ? "border-primary" : "border-border")
            }
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {actor.kind.replaceAll("_", " ")}
            </p>
            <h3 className="mt-2 font-semibold">{actor.label}</h3>
            <p className="mt-3 text-xs text-muted-foreground">{actorHelp(actor.kind)}</p>
          </button>
        ))}
      </div>

      {selected?.kind === "wa_enrichment" && (
        <section className="space-y-4 rounded-lg border border-primary/30 bg-primary/[0.03] p-5">
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-primary">Run actor</p>
            <h2 className="mt-2 font-semibold">Washington Public Records Enrichment</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Paste the contractor profile array. The backend sends only the supported identity,
              contact and permit seed fields to Apify. The token stays server-side.
            </p>
          </div>
          <textarea
            aria-label="Profiles JSON"
            value={profilesJson}
            onChange={(event) => setProfilesJson(event.target.value)}
            placeholder={'[{"company_name":"PNW POST FRAME LLC","ubi":"604893720","license_number":"PNWPOPF783J7"}]'}
            className="min-h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || Boolean(activeRunId)} onClick={() => void startEnrichment()}>
              {activeRunId ? "Enrichment running…" : busy ? "Starting…" : "Run WA enrichment"}
            </Button>
            {activeRunId && (
              <span className="text-sm text-muted-foreground">
                {activeRun
                  ? activeRun.status + " · " + activeRun.id
                  : "Starting · " + activeRunId}
              </span>
            )}
          </div>
        </section>
      )}

      {selected && (
        <section className="space-y-4 rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{selected.label}</h2>
            <a
              className="text-sm text-primary underline"
              href={"https://console.apify.com/actors/" + actorId}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open actor in Apify
            </a>
          </div>

          {runs.isPending && connections.data?.configured && <p role="status">Loading runs…</p>}
          {runs.isError && (
            <p role="alert" className="text-destructive">
              {runs.error.message}
            </p>
          )}

          <label className="block text-sm" htmlFor="apify-run">
            Completed run
          </label>
          <select
            id="apify-run"
            className="w-full rounded-md border border-border bg-background p-3 text-sm"
            value={runId}
            onChange={(event) => {
              setRunId(event.target.value);
              setPreview(null);
              setResult(null);
              setError("");
            }}
            disabled={busy}
          >
            <option value="">Choose a run</option>
            {runs.data?.runs.map((run) => (
              <option key={run.id} value={run.id} disabled={run.status !== "SUCCEEDED"}>
                {new Date(run.started_at).toLocaleString() + " · " + run.status + " · " + run.id}
              </option>
            ))}
          </select>

          {runs.data?.runs.length === 0 && <p>No recent runs were found.</p>}
          {runs.data &&
            runs.data.runs.length > 0 &&
            !runs.data.runs.some((run) => run.status === "SUCCEEDED") && (
              <p className="text-sm text-muted-foreground">
                No successful run is available. Review the failed runs in Apify before importing
                new results.
              </p>
            )}

          <Button disabled={!runId || busy} onClick={() => void inspect()}>
            Preview results
          </Button>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && (
        <section className="space-y-4 rounded-lg border border-border bg-surface-1 p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <h2 className="font-semibold">Review before importing</h2>
            <span className="text-xs text-muted-foreground">
              {preview.page_items} rows · starting at {preview.offset + 1}
              {preview.total_items ? " · " + preview.total_items + " total" : ""}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{preview.notice}</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2">Business / permit</th>
                  <th className="p-2">Evidence snapshot</th>
                  <th className="p-2">Review</th>
                </tr>
              </thead>
              <tbody>
                {preview.records.map((row) => (
                  <tr key={row.index} className="border-b border-border">
                    <td className="p-2">
                      {row.title ?? "Skipped row"}
                      {row.source_url && (
                        <a
                          className="ml-2 text-primary underline"
                          href={row.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Source
                        </a>
                      )}
                    </td>
                    <td className="p-2">
                      {row.observed_at ? new Date(row.observed_at).toLocaleString() : "Unknown"}
                    </td>
                    <td className="p-2">
                      {row.skip ??
                        (selected?.kind === "wa_enrichment"
                          ? "Public-record evidence · borrower facts remain unknown"
                          : selected?.kind === "digital"
                            ? "Matches an existing business only"
                            : "Unverified evidence")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || !preview.records.some((row) => !row.skip)}
              onClick={() => void importPage()}
            >
              {busy ? "Processing…" : "Import this page"}
            </Button>
            {preview.next_offset !== null && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void inspect(preview.next_offset!)}
              >
                Preview next page
              </Button>
            )}
          </div>

          {result && (
            <p role="status" className="rounded-md bg-primary/5 p-3 text-sm">
              {Object.entries(result)
                .map(([key, value]) => key.replaceAll("_", " ") + ": " + value)
                .join(" · ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
