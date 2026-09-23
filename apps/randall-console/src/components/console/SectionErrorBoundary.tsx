import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error);
    reportLovableError(error, { boundary: "console_section", componentStack: info.componentStack });
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <h2 className="text-base font-semibold text-foreground">This section didn't load</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something went wrong while rendering this view."}
        </p>
        <Button onClick={() => this.setState({ error: null })}>Reload</Button>
      </div>
    );
  }
}
