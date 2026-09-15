import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";

type Props = PropsWithChildren<{
  section: string;
  onReturnToOverview: () => void;
}>;

type State = { failed: boolean };

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, info: ErrorInfo) {
    console.error("Bontraco workspace section error", { componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="empty-section" role="alert">
        <h2>{this.props.section} could not load</h2>
        <p>The rest of your workspace is still available. Try again or return to Overview.</p>
        <div className="section-recovery-actions">
          <button
            className="button button-secondary"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </button>
          <button className="button button-primary" onClick={this.props.onReturnToOverview}>
            Return to Overview
          </button>
        </div>
      </section>
    );
  }
}
