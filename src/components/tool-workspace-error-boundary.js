import { Component, createElement } from "react";

function reloadWorkspace() {
  globalThis.location?.reload?.();
}

export function ToolWorkspaceErrorFallback({
  headingRef,
  onBack,
  onReload = reloadWorkspace,
  toolName = "This tool",
}) {
  return createElement(
    "section",
    {
      "aria-labelledby": "tool-workspace-error-title",
      "aria-live": "assertive",
      className: "empty-state",
      role: "alert",
    },
    createElement(
      "h1",
      { id: "tool-workspace-error-title", ref: headingRef, tabIndex: -1 },
      "Tool workspace could not load",
    ),
    createElement(
      "p",
      null,
      `${toolName} encountered a problem. Your dashboard and account are still available.`,
    ),
    createElement(
      "button",
      { className: "primary-button", onClick: onReload, type: "button" },
      "Reload workspace",
    ),
    createElement(
      "button",
      { className: "secondary-button", onClick: onBack, type: "button" },
      "Back to Tool Library",
    ),
  );
}

export default class ToolWorkspaceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
    this.heading = null;
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
    this.heading?.focus();
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return createElement(ToolWorkspaceErrorFallback, {
        headingRef: (element) => {
          this.heading = element;
        },
        onBack: this.props.onBack,
        onReload: this.props.onReload,
        toolName: this.props.toolName,
      });
    }

    return this.props.children;
  }
}
