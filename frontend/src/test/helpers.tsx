import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlanProvider } from '@/state/PlanContext'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function sseResponse(events: Array<[string, unknown]>): Response {
  const text = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('')
  return new Response(text, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

export function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

export function renderWithProviders(ui: ReactElement) {
  return render(
    <QueryClientProvider client={makeClient()}>
      <PlanProvider>{ui}</PlanProvider>
    </QueryClientProvider>,
  )
}

/** Route a mocked fetch by URL substring -> Response factory (or object body). */
export function routeFetch(routes: Record<string, unknown | (() => Response)>) {
  return (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    for (const [key, val] of Object.entries(routes)) {
      if (url.includes(key)) {
        return Promise.resolve(typeof val === 'function' ? (val as () => Response)() : jsonResponse(val))
      }
    }
    return Promise.resolve(jsonResponse({ detail: `no mock for ${url}` }, 404))
  }
}
