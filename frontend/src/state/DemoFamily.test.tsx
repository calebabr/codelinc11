// T38: every visitor gets their own demo family. A small fake backend keeps families in memory so the
// tests can check the whole flow: one-tap sign-in, remembering the family, 410 recovery, the
// "Name your family" card, 429 messages. Ids are suffixed like the real ones (m-xxx.3f9a1c).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { AppRoutes } from "@/App"
import { ACCOUNTS, ALL_MEMBERS, TIER } from "@/test/session"
import { resetThreads } from "@/features/assistant/threads"
import { FAMILY_KEY, SessionProvider } from "./SessionContext"
import type { DemoAccount, FamilyHousehold, FamilyMember } from "@/lib/types/family"

interface Call {
  url: string
  method: string
  body: Record<string, unknown> | null
  auth: string | null
}
let calls: Call[]
let families: Record<string, { members: FamilyMember[]; name: string }>
let gone: Set<string>
let counter: number
let loginStatus: { status: number; body: unknown; headers?: Record<string, string> } | null
let namesReply: { status: number; body: unknown } | null
let chatReply: { status: number; body: unknown } | null

const sfx = (n: number) => `${(0x3f9a1c + n).toString(16)}`

function makeFamily(n: number) {
  const s = sfx(n)
  const members = ALL_MEMBERS.map((m) => ({ ...m, id: `${m.id}.${s}`, household_id: `hh-rivera.${s}` }))
  families[`hh-rivera.${s}`] = { members, name: "Lincoln household" }
  return `hh-rivera.${s}`
}
function householdOf(id: string, viewerId: string): FamilyHousehold {
  const f = families[id]
  const me = f.members.find((m) => m.id === viewerId)!
  return { id, name: f.name, plan_tier: TIER, members: me.role === "primary" ? f.members : [me] }
}
function accountsOf(hid: string): DemoAccount[] {
  return families[hid].members
    .filter((m) => m.has_login)
    .map((m) => ({
      account_id: `acct-${m.id}`,
      email: `${m.name.split(" ")[0].toLowerCase()}@example.test`,
      display_name: m.name,
      member_id: m.id,
      role: m.role,
      household_id: hid,
      ...(m.status === "pending" ? { status: "pending" } : {}),
    }))
}

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

function mockApi() {
  calls = []
  families = {}
  gone = new Set()
  counter = 0
  loginStatus = null
  namesReply = null
  chatReply = null
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null
      const method = init?.method ?? "GET"
      calls.push({ url, method, body, auth: headers.Authorization ?? null })

      if (url.includes("/auth/demo-accounts")) {
        const hid = new URL(url).searchParams.get("household_id")
        if (!hid) return res(200, ACCOUNTS)
        if (gone.has(hid) || !families[hid]) return res(410, { detail: "That demo family has expired." })
        return res(200, accountsOf(hid))
      }
      if (url.endsWith("/auth/demo-login")) {
        if (loginStatus) return res(loginStatus.status, loginStatus.body, loginStatus.headers)
        let hid = body!.household_id as string | undefined
        let memberId = body!.member_id as string
        if (hid) {
          if (gone.has(hid) || !families[hid]) return res(410, { detail: "That demo family has expired." })
        } else {
          hid = makeFamily(counter++)
          memberId = `${memberId}.${hid.split(".")[1]}`
        }
        const member = families[hid].members.find((m) => m.id === memberId)!
        return res(200, {
          token: `tok-${member.id}`,
          member,
          household: householdOf(hid, member.id),
          sandbox: { household_id: hid, expires_at: "2026-11-02T00:00:00Z" },
        })
      }
      const names = url.match(/\/households\/([^/]+)\/names$/)
      if (names && method === "PUT") {
        if (namesReply) return res(namesReply.status, namesReply.body)
        const f = families[decodeURIComponent(names[1])]
        for (const m of (body as { members: { member_id: string; name: string }[] }).members) {
          const target = f.members.find((x) => x.id === m.member_id)
          if (target) target.name = m.name
        }
        const surname = (body as { household_name?: string }).household_name
        if (surname) f.name = `${surname} household`
        return res(200, householdOf(decodeURIComponent(names[1]), headers.Authorization.replace("Bearer tok-", "")))
      }
      const hh = url.match(/\/households\/([^/]+)$/)
      if (hh) return res(200, householdOf(decodeURIComponent(hh[1]), headers.Authorization.replace("Bearer tok-", "")))
      if (url.endsWith("/chat") && method === "POST") {
        if (chatReply) return res(chatReply.status, chatReply.body)
        return new Response("event: token\ndata: {\"text\":\"Hello\"}\n\nevent: done\ndata: {\"mode\":\"anthropic\"}\n\n")
      }
      if (url.includes("/chat/suggestions")) return res(200, { member_id: "x", suggestions: ["A question"] })
      if (url.includes("/assistant-context"))
        return res(200, {
          member_id: "x", name: "X", age: 40, relationship: "self", status: "active", plan: "Preferred", plan_highlights: "",
          history: [], preferences: [], must_haves: [], chat_memory: [], shared_with_assistant: [],
        })
      if (url.includes("/overview"))
        return res(200, {
          member: {}, plan_tier: TIER, usage: { plan_year: 2026, max_used: 0, deductible_met: 0, visits: 0, cleanings_used: 0 },
          benefits: {
            plan_name: "Preferred", annual_max: 1500, max_used: 0, max_remaining: 1500, deductible: 50, deductible_met: 0,
            deductible_remaining: 50, frequencies: [], unused_preventive_value: 0, months_left: 2, reminder: null,
          },
          reminder: null, eligibility: [], as_of: "2026-11-01",
        })
      if (url.includes("/schedule") || url.includes("/procedures")) return res(200, [])
      return res(200, [])
    }),
  )
}

function renderApp(path = "/login") {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  )
}

const loginCalls = () => calls.filter((c) => c.url.endsWith("/auth/demo-login"))
const stored = () => JSON.parse(localStorage.getItem(FAMILY_KEY) ?? "null")

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetThreads()
  mockApi()
})
afterEach(() => vi.restoreAllMocks())

describe("one-tap demo entry", () => {
  it("'Try the demo' on /login signs in as the account holder in a new family and remembers it", async () => {
    const user = userEvent.setup()
    renderApp("/login")
    expect(await screen.findByText(/This is your own demo family\. Changes you make don't affect anyone else\./)).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    expect(await screen.findByTestId("household-label")).toHaveTextContent("Lincoln household")
    expect(loginCalls()).toHaveLength(1)
    // The account holder is picked from the account data (role "primary"), with no household id yet.
    expect(loginCalls()[0].body).toEqual({ member_id: ACCOUNTS.find((a) => a.role === "primary")!.member_id, sandbox: true })
    expect(stored()).toMatchObject({ v: 1, household_id: "hh-rivera.3f9a1c", naming_pending: true })
    expect(screen.getByText(/This is your own demo family/)).toBeInTheDocument() // also on Home
    expect(await screen.findByRole("heading", { name: "Name your family" })).toBeInTheDocument()
  })

  it("has no sign-up form, email field or password field", async () => {
    renderApp("/login")
    await screen.findByRole("button", { name: /Try the demo/ })
    expect(document.querySelector("input")).toBeNull()
  })

  it("asks for the demo accounts of the remembered family and signs in to the same family", async () => {
    const hid = makeFamily(0)
    counter = 1
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: hid, naming_pending: false }))
    const user = userEvent.setup()
    renderApp("/login")
    expect(await screen.findByRole("button", { name: /Continue your demo family/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Try the demo/ })).toBeNull()
    expect(calls.some((c) => c.url.includes(`/auth/demo-accounts?household_id=${encodeURIComponent(hid)}`))).toBe(true)
    // The account cards stay below, for the same family.
    await user.click(await screen.findByRole("button", { name: /Mary/ }))
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Mary"))
    expect(loginCalls()[0].body).toEqual({ member_id: "m-alex.3f9a1c", sandbox: true, household_id: hid })
    expect(Object.keys(families)).toHaveLength(1) // reused, not a new family
  })

  it("'Continue your demo family' signs in as the account holder of the same family", async () => {
    const hid = makeFamily(0)
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: hid, naming_pending: false }))
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Continue your demo family/ }))
    expect(await screen.findByTestId("household-label")).toBeInTheDocument()
    expect(loginCalls()[0].body).toMatchObject({ household_id: hid, sandbox: true })
    expect(screen.queryByRole("heading", { name: "Name your family" })).toBeNull()
  })

  it("a refresh in the same tab reuses the family and the person", async () => {
    const user = userEvent.setup()
    const first = renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Mary/ }))
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Mary"))
    first.unmount()
    renderApp("/plans")
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Mary"))
    expect(Object.keys(families)).toHaveLength(1)
    expect(loginCalls().at(-1)!.body).toMatchObject({ household_id: "hh-rivera.3f9a1c" })
  })

  it("'Start a fresh family' forgets the remembered family", async () => {
    const hid = makeFamily(0)
    counter = 1
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: hid, naming_pending: false }))
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: "Start a fresh family" }))
    expect(await screen.findByRole("button", { name: /Try the demo/ })).toBeInTheDocument()
    expect(localStorage.getItem(FAMILY_KEY)).toBeNull()
    await user.click(screen.getByRole("button", { name: /Try the demo/ }))
    await screen.findByTestId("household-label")
    expect(loginCalls()[0].body).not.toHaveProperty("household_id")
    expect(stored().household_id).not.toBe(hid)
  })

  it("ignores bad JSON and a wrong version in storage", async () => {
    localStorage.setItem(FAMILY_KEY, "{not json")
    const first = renderApp("/login")
    expect(await screen.findByRole("button", { name: /Try the demo/ })).toBeInTheDocument()
    first.unmount()
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 2, household_id: "hh-x" }))
    renderApp("/login")
    expect(await screen.findByRole("button", { name: /Try the demo/ })).toBeInTheDocument()
    expect(calls.every((c) => !c.url.includes("household_id="))).toBe(true)
  })

  it("an unknown family on load (410) falls back to a new family", async () => {
    const hid = makeFamily(0)
    gone.add(hid)
    counter = 1
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: hid, naming_pending: false }))
    renderApp("/login")
    expect(await screen.findByRole("button", { name: /Try the demo/ })).toBeInTheDocument()
    expect(localStorage.getItem(FAMILY_KEY)).toBeNull()
    expect(screen.getByRole("button", { name: /Abraham Lincoln/ })).toBeInTheDocument() // template accounts again
  })

  it("a family that expires while the page is open (410 on sign-in) is replaced by a new one as the same person", async () => {
    const hid = makeFamily(0)
    counter = 1
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: hid, naming_pending: false }))
    const user = userEvent.setup()
    renderApp("/login")
    const card = await screen.findByRole("button", { name: /Mary/ })
    gone.add(hid)
    await user.click(card)
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Mary"))
    const logins = loginCalls()
    expect(logins).toHaveLength(2)
    expect(logins[0].body).toMatchObject({ member_id: "m-alex.3f9a1c", household_id: hid })
    expect(logins[1].body).toEqual({ member_id: "m-alex", sandbox: true }) // template id, new family
    expect(stored().household_id).not.toBe(hid)
  })

  it("shows the pending label from the account's own status", async () => {
    renderApp("/login")
    expect(await screen.findByRole("button", { name: /Robert/ })).toHaveTextContent("Waiting for approval")
    expect(screen.getByRole("button", { name: /Mary/ })).not.toHaveTextContent("Waiting for approval")
  })
})

describe("429 too many requests", () => {
  it("sign-in shows a plain wait message, not a crash", async () => {
    loginStatus = {
      status: 429,
      body: { detail: "Slow down.", retry_after: 17 },
      headers: { "Retry-After": "17" },
    }
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Please wait about 17 seconds and try again.")
    expect(screen.getByRole("button", { name: /Try the demo/ })).toBeEnabled()
  })

  it("uses the Retry-After header when the body has no retry_after", async () => {
    loginStatus = { status: 429, body: {}, headers: { "Retry-After": "5" } }
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("about 5 seconds")
  })

  it("chat shows the wait inside the conversation, with a Try again that waits", async () => {
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    await screen.findByTestId("household-label")
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Assistant" }))
    chatReply = { status: 429, body: { detail: "Too many.", retry_after: 2 } }
    await user.click(await screen.findByRole("button", { name: "A question" }))
    const bubble = await screen.findByTestId("msg-assistant")
    expect(within(bubble).getByRole("alert")).toHaveTextContent("Please wait about 2 seconds and try again.")
    const retry = within(bubble).getByRole("button", { name: /Try again in \d+s/ })
    expect(retry).toBeDisabled()
    // After the wait the button works, and the retry asks the question again.
    chatReply = null
    const again = await within(bubble).findByRole("button", { name: "Try again" }, { timeout: 4000 })
    expect(again).toBeEnabled()
    await user.click(again)
    expect(await screen.findByText("Hello")).toBeInTheDocument()
  })
})

describe("Name your family", () => {
  async function signInFresh() {
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    await screen.findByRole("heading", { name: "Name your family" })
    return user
  }

  it("shows four labelled fields prefilled by role and relationship, an optional surname and the helper line", async () => {
    await signInFresh()
    expect(screen.getByLabelText("You")).toHaveValue("Abraham Lincoln")
    expect(screen.getByLabelText("Your spouse")).toHaveValue("Mary")
    expect(screen.getByLabelText("Your young child")).toHaveValue("Tad")
    expect(screen.getByLabelText("Your older child")).toHaveValue("Robert")
    expect(screen.getByText("You manage their account.")).toBeInTheDocument()
    expect(screen.getByText("Too old to be a dependent, has their own account.")).toBeInTheDocument()
    expect(screen.getByLabelText("Family surname (optional)")).toHaveValue("Lincoln")
    expect(screen.getByText("Use made-up names, this is a demo.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument()
  })

  it("saves only what changed, updates every screen without a reload, and goes away", async () => {
    const user = await signInFresh()
    const you = screen.getByLabelText("You")
    await user.clear(you)
    await user.type(you, "Sam Lee")
    const child = screen.getByLabelText("Your young child")
    await user.clear(child)
    await user.type(child, "Mia O'Brien-Smith")
    const surname = screen.getByLabelText("Family surname (optional)")
    await user.clear(surname)
    await user.type(surname, "Lee")
    await user.click(screen.getByRole("button", { name: "Save names" }))
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Name your family" })).toBeNull())
    const put = calls.find((c) => c.method === "PUT" && c.url.endsWith("/names"))!
    expect(put.auth).toBe("Bearer tok-m-jordan.3f9a1c")
    expect(put.url).toContain("/households/hh-rivera.3f9a1c/names")
    expect(put.body).toEqual({
      household_name: "Lee",
      members: [
        { member_id: "m-jordan.3f9a1c", name: "Sam Lee" },
        { member_id: "m-maya.3f9a1c", name: "Mia O'Brien-Smith" },
      ],
    })
    expect(screen.getByTestId("household-label")).toHaveTextContent("Lee household")
    expect(screen.getByTestId("active-member-label")).toHaveTextContent("Sam Lee")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, Sam")
    expect(stored().naming_pending).toBe(false)
    // Same ids went to the server; ids never changed on screen either.
    expect(loginCalls()).toHaveLength(1)
  })

  it("Skip hides the card without calling the server and does not come back after a reload", async () => {
    const user = await signInFresh()
    await user.click(screen.getByRole("button", { name: "Skip" }))
    expect(screen.queryByRole("heading", { name: "Name your family" })).toBeNull()
    expect(calls.some((c) => c.method === "PUT")).toBe(false)
    expect(stored().naming_pending).toBe(false)
  })

  it("shows inline messages for names the server would refuse, and sends nothing", async () => {
    const user = await signInFresh()
    const you = screen.getByLabelText("You")
    await user.clear(you)
    await user.type(you, "Sam 3")
    await user.tab()
    expect(await screen.findByText("Use letters, spaces, apostrophes, hyphens and periods only.")).toBeInTheDocument()
    expect(you).toHaveAttribute("aria-invalid", "true")
    await user.clear(you)
    await user.click(screen.getByRole("button", { name: "Save names" }))
    expect(await screen.findByText("Please enter a name.")).toBeInTheDocument()
    await user.type(you, "A".repeat(25))
    expect(await screen.findByText("Use 24 characters or fewer.")).toBeInTheDocument()
    expect(calls.some((c) => c.method === "PUT")).toBe(false)
  })

  it("shows the server's plain message when it answers 422", async () => {
    const user = await signInFresh()
    namesReply = { status: 422, body: { detail: "A name can only use letters, spaces, apostrophes, hyphens and periods." } }
    const you = screen.getByLabelText("You")
    await user.clear(you)
    await user.type(you, "Sam")
    await user.click(screen.getByRole("button", { name: "Save names" }))
    expect(await screen.findByText("A name can only use letters, spaces, apostrophes, hyphens and periods.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Name your family" })).toBeInTheDocument() // still there to fix
  })

  it("is not offered when someone other than the account holder starts a new family", async () => {
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Mary/ }))
    await screen.findByTestId("household-label")
    expect(screen.queryByRole("heading", { name: "Name your family" })).toBeNull()
    expect(stored().naming_pending).toBe(false)
  })

  it("'Rename family' on the Family page opens the same form for the account holder", async () => {
    const user = userEvent.setup()
    renderApp("/login")
    await user.click(await screen.findByRole("button", { name: /Try the demo/ }))
    await user.click(await screen.findByRole("button", { name: "Skip" }))
    await user.click(within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Family" }))
    await user.click(await screen.findByRole("button", { name: "Rename family" }))
    expect(screen.getByRole("heading", { name: "Rename family" })).toBeInTheDocument()
    expect(screen.getByLabelText("Your spouse")).toHaveValue("Mary")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByRole("button", { name: "Rename family" })).toBeInTheDocument()
  })
})

describe("no hard-coded template ids", () => {
  it("keeps member and household ids out of application code", () => {
    const files = import.meta.glob("/src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>
    const offenders = Object.entries(files)
      .filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.includes("/src/test/") && !path.includes("/components/landing/"))
      .filter(([, text]) => /\b(m-(alex|jordan|noah|maya)|hh-rivera)\b/.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
