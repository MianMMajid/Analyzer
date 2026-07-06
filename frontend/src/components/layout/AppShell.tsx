import { useEffect, useMemo, useState, type CSSProperties, type PropsWithChildren } from 'react'

// The shell is shared UI: navigation and page chrome live here, feature logic does not.
type AppShellProps = PropsWithChildren<{
  eyebrow: string
  title: string
  summary: string
}>

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'leaderboard', label: 'Top 5' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'methodology', label: 'Method' },
] as const

export function AppShell({ children, eyebrow, summary, title }: AppShellProps) {
  const [activeSectionId, setActiveSectionId] = useState<(typeof navItems)[number]['id']>('overview')
  const activeIndex = useMemo(
    () => Math.max(0, navItems.findIndex((item) => item.id === activeSectionId)),
    [activeSectionId],
  )

  useEffect(() => {
    const sections = navItems
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null)

    if (sections.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]

        if (visibleEntry?.target.id !== undefined) {
          setActiveSectionId(visibleEntry.target.id as (typeof navItems)[number]['id'])
        }
      },
      {
        rootMargin: '-20% 0px -58% 0px',
        threshold: [0.1, 0.35, 0.6],
      },
    )

    for (const section of sections) {
      observer.observe(section)
    }

    return () => observer.disconnect()
  }, [])

  const navStyle = {
    '--active-index': activeIndex,
    '--nav-items': navItems.length,
  } as CSSProperties

  return (
    <div className="app-shell">
      <aside className="app-sidebar glass-panel" aria-label="Dashboard navigation" style={navStyle}>
        <a className="brand-mark" href="#overview" aria-label="PostHog impact overview">
          PH
        </a>
        <nav className="app-nav">
          {navItems.map((item) => (
            <a
              aria-current={activeSectionId === item.id ? 'page' : undefined}
              data-active={activeSectionId === item.id}
              href={`#${item.id}`}
              key={item.id}
              onClick={() => setActiveSectionId(item.id)}
            >
              {item.label}
            </a>
          ))}
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
