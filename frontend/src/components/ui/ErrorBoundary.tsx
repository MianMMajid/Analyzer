import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      JSON.stringify({
        event: 'frontend_render_failed',
        error: {
          name: error.name,
          message: error.message,
        },
        componentStack: errorInfo.componentStack,
      }),
    )
  }

  override render() {
    if (this.state.error !== null) {
      return (
        <main className="app-main">
          <section className="error-boundary" role="alert">
            <p className="eyebrow">Dashboard unavailable</p>
            <h1>Something went wrong.</h1>
            <p className="hero-summary">
              The dashboard failed to render. Refresh the page or check the browser console.
            </p>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
