import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders a fallback when child rendering fails', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function BrokenDashboard(): never {
      throw new Error('render failed')
    }

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <BrokenDashboard />
        </ErrorBoundary>,
      )
    })

    expect(container.textContent).toContain('Dashboard unavailable')
    expect(container.textContent).toContain('Something went wrong.')

    await act(async () => {
      root.unmount()
    })
  })
})
