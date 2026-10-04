import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { NotificationBell } from "./NotificationBell"
import { HomeNotificationsCard } from "./HomeNotificationsCard"
import NotificationsPage from "@/pages/Notifications/NotificationsPage"
import { AppRoutes } from "@/App"

type N = {
  id: number
  member_id: string
  kind: string
  title: string
  body: string
  severity: "info" | "warning" | "success"
  link: string | null
  created_at: string
  read_at: string | null
}

function note(id: number, over: Partial<N> = {}): N {
  return {
    id,
    member_id: "m-jordan",
    kind: "benefits_expiring",
    title: `Alert ${id}`,
    body: `Body for alert ${id}`,
    severity: "info",
    link: null,
    created_at: "2026-11-01T10:00:00",
    read_at: null,
    ...over,
  }
}

const SCHEDULE = [
  { id: 1, member_id: "m-jordan", member_name: "Marc", kind: "appointment", due_date: "2026-11-18", title: "Cleaning visit", note: null },
  { id: 2, member_id: "m-jordan", member_name: "Marc", kind: "reminder", due_date: "2026-12-01", title: "Use your benefits", note: null },
  { id: 3, member_id: "m-jordan", member_name: "Marc", kind: "reminder", due_date: "2026-12-10", title: "Third", note: null },
  { id: 4, member_id: "m-jordan", member_name: "Marc", kind: "reminder", due_date: "2026-12-20", title: "Fourth hidden", note: null },
]

let items: N[]
let schedule: unknown[]
let prefs: Record<string, unknown>
let outbox: unknown[]
let calls: { method: string; url: string; body: unknown }[]
let failNotifications: "" | "429" | "500"
let putStatus: 200 | 422 | 403

function res(status: number, data: unknown) {
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => data }
}

function mockApi() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : null })
      if (/\/notifications\/read-all$/.test(url)) {
        items = items.map((n) => ({ ...n, read_at: "2026-11-02T00:00:00" }))
        return res(200, { ok: true, marked: 1, unread_count: 0 })
      }
      const one = url.match(/\/notifications\/(\d+)\/read$/)
      if (one) {
        items = items.map((n) => (String(n.id) === one[1] ? { ...n, read_at: "2026-11-02T00:00:00" } : n))
        return res(200, { ok: true, marked: 1, unread_count: items.filter((n) => !n.read_at).length })
      }
      if (/\/notifications\/test$/.test(url)) {
        const ch = JSON.parse(String(init?.body)).channel
        return res(200, { ok: true, channel: ch, notification: null, outbox: ch === "app" ? null : { id: 1 } })
      }
      if (/\/notifications(\?unread=1)?$/.test(url)) {
        if (failNotifications === "429") return { ...res(429, { detail: "slow", retry_after: 7 }) }
        if (failNotifications === "500") return res(500, { detail: "Server broke." })
        const unreadOnly = url.includes("unread=1")
        const list = unreadOnly ? items.filter((n) => !n.read_at) : items
        return res(200, { notifications: list, unread_count: items.filter((n) => !n.read_at).length, app_enabled: true })
      }
      if (/\/notification-prefs$/.test(url)) {
        if (method === "PUT") {
          if (putStatus === 422) return res(422, { detail: "Add an email address to Sophia's profile before turning on email." })
          if (putStatus === 403) return res(403, { detail: "the shared demo family can't be edited; start your own demo family" })
          prefs = { ...prefs, ...JSON.parse(String(init?.body)) }
        }
        return res(200, prefs)
      }
      if (/\/outbox$/.test(url)) return res(200, outbox)
      if (/\/schedule$/.test(url)) return res(200, schedule)
      return res(404, {})
    }),
  )
}

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.hash}</p>
}

function renderBell(active = "m-jordan", path = "/") {
  return render(
    <TestSessionProvider activeId={active}>
      <MemoryRouter initialEntries={[path]}>
        <div data-testid="outside">outside</div>
        <NotificationBell />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => {
  items = [note(1, { severity: "warning", link: "/costs" }), note(2, { severity: "success" }), note(3)]
  schedule = SCHEDULE
  prefs = { app: true, email: false, sms: false, types: null, email_on_file: true, phone_on_file: false }
  outbox = []
  failNotifications = ""
  putStatus = 200
  mockApi()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("Notification bell", () => {
  it("shows the unread count with an accessible name and expanded state", async () => {
    renderBell()
    const bell = await screen.findByRole("button", { name: "Notifications, 3 unread" })
    expect(bell).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByTestId("bell-badge")).toHaveTextContent("3")
    expect(bell.className).toContain("size-11")
    expect(calls.find((c) => c.url.includes("/notifications"))!.url).toContain("/members/m-jordan/notifications?unread=1")
  })

  it("hides the badge at zero and shows 9+ above nine", async () => {
    items = []
    const first = renderBell()
    await screen.findByRole("button", { name: "Notifications, 0 unread" })
    expect(screen.queryByTestId("bell-badge")).toBeNull()
    first.unmount()
    items = Array.from({ length: 12 }, (_, i) => note(i + 1))
    renderBell()
    expect(await screen.findByRole("button", { name: "Notifications, 12 unread" })).toBeInTheDocument()
    expect(screen.getByTestId("bell-badge")).toHaveTextContent("9+")
  })

  it("opens a panel with Coming up (3 items, date chips) and Alerts with severity", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button", { name: /Notifications, 3 unread/ }))
    const panel = await screen.findByRole("region", { name: "Notifications" })
    expect(within(panel).getByRole("heading", { name: "Coming up" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId("bell-upcoming")).toHaveLength(3))
    expect(screen.getByText("Nov 18")).toBeInTheDocument()
    expect(screen.getByText("Cleaning visit")).toBeInTheDocument()
    expect(screen.queryByText("Fourth hidden")).toBeNull()
    expect(within(panel).getByRole("heading", { name: "Alerts" })).toBeInTheDocument()
    const alerts = screen.getAllByTestId("bell-alert")
    expect(alerts).toHaveLength(3)
    expect(alerts[0]).toHaveAttribute("data-severity", "warning")
    expect(alerts[0].className).toContain("border-orange-dark")
    expect(alerts[1].className).toContain("border-ok")
    expect(within(panel).getByRole("link", { name: "See all notifications" })).toHaveAttribute("href", "/notifications")
    expect(within(panel).getByRole("link", { name: "Notification settings" })).toHaveAttribute("href", "/notifications#settings")
    expect(screen.getByRole("button", { name: /Notifications, 3 unread/ })).toHaveAttribute("aria-expanded", "true")
  })

  it("closes on Escape with focus back on the bell, and on an outside click", async () => {
    const user = userEvent.setup()
    renderBell()
    const bell = await screen.findByRole("button", { name: /Notifications, 3 unread/ })
    await user.click(bell)
    expect(await screen.findByRole("region", { name: "Notifications" })).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull()
    expect(bell).toHaveFocus()
    await user.click(bell)
    expect(await screen.findByRole("region", { name: "Notifications" })).toBeInTheDocument()
    await user.click(screen.getByTestId("outside"))
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull()
  })

  it("closes on a route change", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button", { name: /Notifications, 3 unread/ }))
    await user.click(await screen.findByRole("link", { name: "See all notifications" }))
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull()
    expect(screen.getByTestId("where")).toHaveTextContent("/notifications")
  })

  it("marks one alert read, updates the badge and follows its link", async () => {
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button", { name: /Notifications, 3 unread/ }))
    await user.click((await screen.findAllByTestId("bell-alert"))[0])
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/costs"))
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/members/m-jordan/notifications/1/read"))).toBe(true)
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Notifications" })).toBeNull()
  })

  it("marks all as read and then shows the caught-up message", async () => {
    schedule = []
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button", { name: /Notifications, 3 unread/ }))
    await user.click(await screen.findByRole("button", { name: "Mark all as read" }))
    expect(await screen.findByRole("button", { name: "Notifications, 0 unread" })).toBeInTheDocument()
    expect(await screen.findByText("You are all caught up.")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/notifications/read-all"))).toBe(true)
  })

  it("shows whose notifications when viewing someone else, and reloads for them", async () => {
    const user = userEvent.setup()
    renderBell("m-maya")
    await user.click(await screen.findByRole("button", { name: /Notifications/ }))
    expect(await screen.findByRole("region", { name: "Sophia's notifications" })).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes("/members/m-maya/notifications"))).toBe(true)
    expect(calls.some((c) => c.url.includes("/members/m-maya/schedule"))).toBe(true)
  })

  it("shows the wait message on a 429 and a plain error with a retry", async () => {
    failNotifications = "429"
    const user = userEvent.setup()
    renderBell()
    await user.click(await screen.findByRole("button", { name: /Notifications/ }))
    expect(await screen.findByText(/going a little fast. Please wait about 7 seconds/)).toBeInTheDocument()
    failNotifications = ""
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findAllByTestId("bell-alert")).toHaveLength(3)
  })

  it("refreshes every 60 seconds while the tab is visible", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderBell()
    await screen.findByRole("button", { name: /Notifications, 3 unread/ })
    const before = calls.filter((c) => c.url.includes("/notifications")).length
    items = [...items, note(4)]
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    await screen.findByRole("button", { name: "Notifications, 4 unread" })
    expect(calls.filter((c) => c.url.includes("/notifications")).length).toBeGreaterThan(before)
  })
})

describe("Notifications page", () => {
  function renderPage(active = "m-jordan", path = "/notifications") {
    return render(
      <TestSessionProvider activeId={active}>
        <MemoryRouter initialEntries={[path]}>
          <NotificationBell />
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </TestSessionProvider>,
    )
  }

  beforeEach(() => {
    items = [
      note(1, { kind: "upcoming_appointment", title: "Visit soon" }),
      note(2, { kind: "claim_update", title: "Claim moved", severity: "success", read_at: "2026-11-01T12:00:00" }),
      note(3, { kind: "benefits_expiring", title: "Benefits ending", severity: "warning", link: "/plan-year" }),
      note(4, { kind: "reminder", title: "A reminder" }),
    ]
  })

  it("lists the feed and filters it", async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findAllByTestId("notif-item")).toHaveLength(4)
    await user.click(screen.getByRole("button", { name: "Unread" }))
    expect(screen.getAllByTestId("notif-item")).toHaveLength(3)
    await user.click(screen.getByRole("button", { name: "Appointments and reminders" }))
    expect(screen.getAllByTestId("notif-item").map((e) => e.textContent)).toEqual([
      expect.stringContaining("Visit soon"),
      expect.stringContaining("A reminder"),
    ])
    await user.click(screen.getByRole("button", { name: "Benefits" }))
    expect(screen.getAllByTestId("notif-item")).toHaveLength(1)
    await user.click(screen.getByRole("button", { name: "Claims" }))
    expect(screen.getAllByTestId("notif-item")[0]).toHaveTextContent("Claim moved")
    expect(screen.getByRole("button", { name: "Claims" })).toHaveAttribute("aria-pressed", "true")
  })

  it("marks one read and all read, and the bell badge follows", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("notif-item")
    expect(await screen.findByRole("button", { name: "Notifications, 3 unread" })).toBeInTheDocument()
    await user.click(within(screen.getAllByTestId("notif-item")[0]).getByRole("button", { name: "Mark as read" }))
    expect(await screen.findByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Mark all as read" }))
    expect(await screen.findByRole("button", { name: "Notifications, 0 unread" })).toBeInTheDocument()
  })

  it("opens an item's link", async () => {
    const user = userEvent.setup()
    renderPage()
    const item = (await screen.findAllByTestId("notif-item"))[2]
    await user.click(within(item).getByRole("button", { name: "Open" }))
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/plan-year"))
  })

  it("shows an empty state and an error state", async () => {
    items = []
    const first = renderPage()
    expect(await screen.findByTestId("notif-empty")).toHaveTextContent("You are all caught up.")
    first.unmount()
    failNotifications = "500"
    renderPage()
    expect(await screen.findAllByText("Server broke.")).not.toHaveLength(0)
  })

  describe("settings", () => {
    it("shows toggles with aria-pressed, missing contact notes and a link to Family", async () => {
      renderPage()
      const app = await screen.findByRole("button", { name: /^App(On|Off)$/ })
      expect(app).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByRole("button", { name: /^Email/ })).toHaveAttribute("aria-pressed", "false")
      expect(screen.getByText(/No phone on file/)).toBeInTheDocument()
      expect(screen.queryByText(/No email on file/)).toBeNull()
      expect(screen.getAllByRole("link", { name: /Add one on the Family page/ })[0]).toHaveAttribute("href", "/family")
      expect(document.querySelector("select")).toBeNull()
    })

    it("sends a PUT with the full preferences when a channel is switched", async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole("button", { name: /^Email/ }))
      await waitFor(() => expect(screen.getByRole("button", { name: /^Email/ })).toHaveAttribute("aria-pressed", "true"))
      const put = calls.find((c) => c.method === "PUT")!
      expect(put.url).toContain("/members/m-jordan/notification-prefs")
      expect(put.body).toEqual({ app: true, email: true, sms: false, types: null, email_on_file: true, phone_on_file: false })
    })

    it("sends the chosen alert kinds", async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole("button", { name: "Claim updates" }))
      await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true))
      const put = calls.find((c) => c.method === "PUT")!.body as { types: string[] }
      expect(put.types).not.toContain("claim_update")
      expect(put.types).toContain("reminder")
      await waitFor(() => expect(screen.getByRole("button", { name: "Claim updates" })).toHaveAttribute("aria-pressed", "false"))
    })

    it("shows the 422 message and keeps the toggle off", async () => {
      putStatus = 422
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole("button", { name: /^Text message/ }))
      expect(await screen.findByText("Add an email address to Sophia's profile before turning on email.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /^Text message/ })).toHaveAttribute("aria-pressed", "false")
    })

    it("shows the 403 message calmly and makes the settings read-only", async () => {
      putStatus = 403
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole("button", { name: /^Email/ }))
      expect(await screen.findByText(/shared demo family can't be edited/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /^Email/ })).toBeDisabled()
      expect(await screen.findByRole("button", { name: /Send me a test email/ })).toBeDisabled()
    })

    it("sends a test for each channel and lists the delivery preview with the banner", async () => {
      const user = userEvent.setup()
      renderPage()
      expect(await screen.findByTestId("outbox-banner")).toHaveTextContent("Demo only: emails and text messages are previews. Nothing is sent.")
      outbox = [
        { id: 1, member_id: "m-jordan", channel: "email", to_address: "jordan@example.test", subject: "Test email", body: "Hello there", created_at: "2026-11-02T09:00:00", status: "preview" },
      ]
      // Wait for each control: on a slow machine the settings can still be drawing when the banner appears.
      await user.click(await screen.findByRole("button", { name: /Send me a test email/ }))
      expect(await screen.findByTestId("outbox-item")).toHaveTextContent("jordan@example.test")
      expect(await screen.findByTestId("outbox-item")).toHaveTextContent("Test email")
      await user.click(await screen.findByRole("button", { name: /Send me a test notification/ }))
      await user.click(await screen.findByRole("button", { name: /Send me a test text/ }))
      await waitFor(() => {
        const sent = calls.filter((c) => c.url.endsWith("/notifications/test")).map((c) => (c.body as { channel: string }).channel)
        expect(sent).toEqual(["email", "app", "sms"])
      })
    })

    it("has the #settings anchor", async () => {
      renderPage("m-jordan", "/notifications#settings")
      const section = await screen.findByRole("heading", { name: /Settings for Marc/ })
      expect(section.closest("section")).toHaveAttribute("id", "settings")
    })
  })
})

describe("Home notifications card", () => {
  it("shows the top 3 unread, the count and a link", async () => {
    items = [note(1), note(2), note(3), note(4)]
    render(
      <TestSessionProvider>
        <MemoryRouter>
          <HomeNotificationsCard />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    expect(await screen.findAllByTestId("home-notification")).toHaveLength(3)
    expect(screen.getByText("4 unread")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See all notifications" })).toHaveAttribute("href", "/notifications")
  })

  it("shows the empty state", async () => {
    items = []
    render(
      <TestSessionProvider>
        <MemoryRouter>
          <HomeNotificationsCard />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    expect(await screen.findByText("You are all caught up.")).toBeInTheDocument()
  })
})

describe("Bell in the shell", () => {
  it.each(["/", "/plans", "/family", "/costs", "/plan-year", "/assistant", "/notifications"])("appears on %s", async (path) => {
    render(
      <TestSessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    expect(await screen.findByRole("button", { name: /^Notifications, \d+ unread$/ })).toBeInTheDocument()
  })
})
