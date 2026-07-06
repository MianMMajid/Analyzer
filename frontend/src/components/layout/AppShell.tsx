import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from 'react'

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

type NavItemId = (typeof navItems)[number]['id']

function isNavItemId(value: string): value is NavItemId {
  return navItems.some((item) => item.id === value)
}

export function AppShell({ children, eyebrow, summary, title }: AppShellProps) {
  const [activeSectionId, setActiveSectionId] = useState<NavItemId>('overview')
  const clickLockUntilRef = useRef(0)
  const scrollFrameRef = useRef<number | null>(null)
  const activeIndex = useMemo(
    () => Math.max(0, navItems.findIndex((item) => item.id === activeSectionId)),
    [activeSectionId],
  )

  const updateActiveSectionFromScroll = useCallback(() => {
    if (Date.now() < clickLockUntilRef.current) {
      return
    }

    const hashId = window.location.hash.slice(1)

    if (window.scrollY < 24 && !isNavItemId(hashId)) {
      setActiveSectionId('overview')
      return
    }

    if (document.documentElement.scrollHeight - window.innerHeight <= 160) {
      setActiveSectionId(isNavItemId(hashId) ? hashId : 'overview')
      return
    }

    const activationY = window.scrollY + Math.min(window.innerHeight * 0.36, 280)
    let nextSectionId: NavItemId = 'overview'

    for (const item of navItems) {
      const element = document.getElementById(item.id)

      if (element === null) {
        continue
      }

      const elementTop = element.getBoundingClientRect().top + window.scrollY

      if (elementTop <= activationY) {
        nextSectionId = item.id
      }
    }

    setActiveSectionId(nextSectionId)
  }, [])

  useEffect(() => {
    function scheduleActiveSectionUpdate() {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null
        updateActiveSectionFromScroll()
      })
    }

    function updateFromHash() {
      const hashId = window.location.hash.slice(1)

      if (isNavItemId(hashId)) {
        setActiveSectionId(hashId)
      }
    }

    const mutationObserver = new MutationObserver(scheduleActiveSectionUpdate)

    scheduleActiveSectionUpdate()
    updateFromHash()
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('hashchange', updateFromHash)
    window.addEventListener('resize', scheduleActiveSectionUpdate)
    window.addEventListener('scroll', scheduleActiveSectionUpdate, { passive: true })

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current)
      }

      mutationObserver.disconnect()
      window.removeEventListener('hashchange', updateFromHash)
      window.removeEventListener('resize', scheduleActiveSectionUpdate)
      window.removeEventListener('scroll', scheduleActiveSectionUpdate)
    }
  }, [updateActiveSectionFromScroll])

  function handleNavigationClick(sectionId: NavItemId) {
    const target = document.getElementById(sectionId)

    clickLockUntilRef.current = Date.now() + 900
    setActiveSectionId(sectionId)

    if (target === null) {
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${sectionId}`)
    window.setTimeout(updateActiveSectionFromScroll, 950)
  }

  const navStyle = {
    '--active-index': activeIndex,
    '--nav-items': navItems.length,
  } as CSSProperties

  return (
    <div className="app-shell" data-active-section={activeSectionId}>
      <div className="app-dock glass-panel" role="navigation" aria-label="Dashboard navigation" style={navStyle}>
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
              onClick={(event) => {
                event.preventDefault()
                handleNavigationClick(item.id)
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

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
