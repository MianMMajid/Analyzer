import type { PropsWithChildren } from 'react'

// The shell is shared UI: navigation and page chrome live here, feature logic does not.
type AppShellProps = PropsWithChildren<{
  eyebrow: string
  title: string
  summary: string
}>

export function AppShell({ children, eyebrow, summary, title }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar glass-panel" aria-label="Dashboard navigation">
        <a className="brand-mark" href="#overview" aria-label="PostHog impact overview">
          PH
        </a>
        <nav className="app-nav">
          <a href="#overview">Overview</a>
          <a href="#leaderboard">Top 5</a>
          <a href="#evidence">Evidence</a>
          <a href="#methodology">Method</a>
        </nav>
      </aside>

      <main className="app-main">
        <section className="hero-section" id="overview">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="hero-summary">{summary}</p>
        </section>
        {children}
      </main>
    </div>
  )
}
