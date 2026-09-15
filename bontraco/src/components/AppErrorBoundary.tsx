import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

type State = { error: Error | null };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Bontraco application error", {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="state-page" role="alert">
        <div className="brand-mark" aria-hidden="true">
          B
        </div>
        <h1>Bontraco needs a quick refresh</h1>
        <p>Your data is safe. Reload the page to restore this workspace.</p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </main>
    );
  }
}
