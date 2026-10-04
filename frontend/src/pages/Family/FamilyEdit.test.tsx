import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { ALL_MEMBERS, MEMBERS, TestSessionProvider, TIER } from "@/test/session"
import type { FamilyMember } from "@/lib/types/family"
import { formatPhone } from "@/features/family/contact"
import FamilyPage from "./FamilyPage"

const SANDBOX = { household_id: "hh-rivera", expires_at: "2026-12-01T00:00:00Z" }
const WITH_CONTACT: FamilyMember[] = ALL_MEMBERS.map((m) =>
  m.id === "m-alex"
    ? { ...m, dob: "1987-03-02", email: "alex@example.test", phone: "3345550143", zip: "36830", notes: "" }
    : m.id === "m-maya"
      ? { ...m, dob: "2017-06-01" }
      : m,
)

interface Call { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
type Responder = (call: Call) => { status: number; body: unknown } | null
let responder: Responder

function overview(id: string) {
  const member = WITH_CONTACT.find((m) => m.id === id) ?? WITH_CONTACT[0]
  return {
    member,
    plan_tier: TIER,
    usage: { plan_year: 2026, max_used: 0, deductible_met: 0, visits: 0, cleanings_used: 0 },
    benefits: { plan_name: "Preferred", annual_max: 1500, max_used: 0, max_remaining: 1500, deductible: 50, deductible_met: 0, deductible_remaining: 50, months_left: 2, reminder: null },
    reminder: null,
    eligibility: [],
    as_of: "2026-11-01",
  }
}

function mockApi() {
  calls = []
  responder = () => null
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const call: Call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null }
      calls.push(call)
      const custom = responder(call)
      if (custom) return { ok: custom.status < 400, status: custom.status, json: async () => custom.body, headers: new Headers() }
      if (url.includes("/overview")) return { ok: true, status: 200, json: async () => overview(url.split("/members/")[1].split("/")[0]) }
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPage(opts: { signedInId?: string; sandbox?: typeof SANDBOX | null } = {}) {
  return render(
    <TestSessionProvider members={WITH_CONTACT} signedInId={opts.signedInId} sandbox={opts.sandbox === undefined ? SANDBOX : opts.sandbox}>
      <MemoryRouter>
        <FamilyPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

const patches = () => calls.filter((c) => c.method === "PATCH")

beforeEach(mockApi)
afterEach(() => vi.restoreAllMocks())

describe("formatPhone", () => {
  it("masks 10 digits and leaves other shapes alone", () => {
    expect(formatPhone("3345550143")).toBe("(334) 555-0143")
    expect(formatPhone("12345")).toBe("12345")
    expect(formatPhone(null)).toBe("")
  })
})

describe("Edit profile", () => {
  it("shows the contact row with a masked phone and empty states", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    expect(screen.getByTestId("contact-email")).toHaveTextContent("alex@example.test")
    expect(screen.getByTestId("contact-phone")).toHaveTextContent("(334) 555-0143")
    await user.click(screen.getByTestId("node-m-maya"))
    expect(screen.getByRole("button", { name: "Add an email" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add a phone" })).toBeInTheDocument()
  })

  it("saves only the changed fields and refreshes the card", async () => {
    const user = userEvent.setup()
    responder = (c) =>
      c.method === "PATCH" ? { status: 200, body: { ...WITH_CONTACT.find((m) => m.id === "m-alex")!, email: "new@example.test" } } : null
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    expect(screen.getByText("Use made-up contact details. Nothing is sent in this demo.")).toBeInTheDocument()
    const email = screen.getByLabelText("Email")
    await user.clear(email)
    await user.type(email, "new@example.test")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(patches()[0].url).toContain("/members/m-alex/profile")
    expect(patches()[0].body).toEqual({ email: "new@example.test" })
    expect(await screen.findByTestId("profile-notice")).toHaveTextContent("AC's profile was saved.")
    expect(screen.getByTestId("contact-email")).toHaveTextContent("new@example.test")
    expect(screen.queryByRole("form")).toBeNull()
  })

  it("sends null for a cleared email and digits only for the phone", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "PATCH" ? { status: 200, body: { ...WITH_CONTACT.find((m) => m.id === "m-alex")!, email: null, phone: "3345550999" } } : null)
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    await user.clear(screen.getByLabelText("Email"))
    const phone = screen.getByLabelText("Text message (SMS) number")
    await user.clear(phone)
    await user.type(phone, "(334) 555-0999")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(patches()).toHaveLength(1))
    expect(patches()[0].body).toEqual({ email: null, phone: "3345550999" })
  })

  it("shows the server's 422 message next to the form and keeps it open", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "PATCH" ? { status: 422, body: { detail: "That email address does not look right." } } : null)
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    await user.type(screen.getByLabelText("Email"), "x")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("That email address does not look right.")
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled()
  })

  it("counts notes up to 200 and Cancel sends nothing", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    await user.type(screen.getByLabelText("Notes"), "hello")
    expect(screen.getByTestId("notes-count")).toHaveTextContent("5 / 200")
    expect(screen.getByLabelText("Notes")).toHaveAttribute("maxLength", "200")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(patches()).toHaveLength(0)
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument()
  })

  it("explains a role change when a birthday makes a child an adult", async () => {
    const user = userEvent.setup()
    responder = (c) =>
      c.method === "PATCH" ? { status: 200, body: { ...WITH_CONTACT.find((m) => m.id === "m-maya")!, dob: "2005-01-01", age: 21, role: "adult" } } : null
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await user.click(screen.getByRole("button", { name: "Edit profile" }))
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "2005-01-01" } })
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByTestId("profile-notice")).toHaveTextContent("Sophia is now 18 and counts as an adult. Adults can have their own account.")
    expect(patches()[0].body).toEqual({ dob: "2005-01-01" })
  })

  it("hides every edit control when the family is not editable", async () => {
    const user = userEvent.setup()
    renderPage({ sandbox: null })
    await user.click(await screen.findByTestId("node-m-maya"))
    expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Add an email" })).toBeNull()
    expect(screen.queryByRole("button", { name: /Add a family member/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove .* from family/ })).toBeNull()
  })

  it("lets a non-primary adult edit only themself", async () => {
    const user = userEvent.setup()
    renderPage({ signedInId: "m-alex" })
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Add a family member/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove .* from family/ })).toBeNull()
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(1)
    void user
  })

  it("does not offer a primary Edit profile for the wrong person when viewing someone else as a non-primary", async () => {
    // Signed in as Hannah (adult, not primary): sees only himself and may edit himself.
    renderPage({ signedInId: "m-noah" })
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeInTheDocument()
  })
})

describe("Add a family member", () => {
  const NEW: FamilyMember = { ...MEMBERS.maya, id: "m-casey", name: "Casey Halog", relationship: "other", age: 30, role: "adult", has_login: false }

  it("adds an extra person and shows them in the tree", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "POST" ? { status: 201, body: NEW } : null)
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add a family member" }))
    await user.type(screen.getByLabelText("Name"), "Casey Halog")
    await user.click(screen.getByRole("button", { name: "Other" }))
    expect(screen.getByRole("button", { name: "Other" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1996-04-04" } })
    await user.type(screen.getByLabelText("Text message (SMS) number (optional)"), "334-555-0100")
    await user.click(screen.getByRole("button", { name: "Add to family" }))
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true))
    const post = calls.find((c) => c.method === "POST")!
    expect(post.url).toContain("/households/hh-rivera/members")
    expect(post.body).toEqual({ name: "Casey Halog", relationship: "other", dob: "1996-04-04", phone: "3345550100" })
    expect(await screen.findByText("Casey Halog was added to your family.")).toBeInTheDocument()
    const extras = screen.getByTestId("extras")
    expect(within(extras).getByTestId("node-m-casey")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(5)
  })

  it("puts a new child under the couple", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "POST" ? { status: 201, body: { ...NEW, relationship: "child", role: "managed", age: 4 } } : null)
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add a family member" }))
    await user.type(screen.getByLabelText("Name"), "Casey Halog")
    await user.click(screen.getByRole("button", { name: "Child" }))
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "2022-04-04" } })
    await user.click(screen.getByRole("button", { name: "Add to family" }))
    const kids = await screen.findByTestId("children")
    expect(within(kids).getByTestId("node-m-casey")).toBeInTheDocument()
  })

  it("asks for what is missing and shows the 8-people error", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "POST" ? { status: 422, body: { detail: "A family can have up to 8 people. Remove someone first." } } : null)
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add a family member" }))
    await user.click(screen.getByRole("button", { name: "Add to family" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a name.")
    expect(calls.some((c) => c.method === "POST")).toBe(false)
    await user.type(screen.getByLabelText("Name"), "Casey")
    await user.click(screen.getByRole("button", { name: "Child" }))
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "2020-01-01" } })
    await user.click(screen.getByRole("button", { name: "Add to family" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("A family can have up to 8 people.")
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(4)
  })
})

describe("Remove from family", () => {
  it("asks first, then removes the person and the tree updates", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "DELETE" ? { status: 200, body: { ok: true, member_id: "m-maya" } } : null)
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await user.click(screen.getByRole("button", { name: "Remove Sophia from family" }))
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
    expect(screen.getByText("Remove Sophia and all of their saved data from your demo family?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Yes, remove Sophia" }))
    await waitFor(() => expect(screen.queryByTestId("node-m-maya")).toBeNull())
    expect(calls.find((c) => c.method === "DELETE")!.url).toContain("/households/hh-rivera/members/m-maya")
    expect(screen.getByText("Sophia was removed from your family.")).toBeInTheDocument()
  })

  it("lets the primary keep the person (Keep) and sends nothing", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await user.click(screen.getByRole("button", { name: "Remove Sophia from family" }))
    await user.click(screen.getByRole("button", { name: "Keep Sophia" }))
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
    expect(screen.getByRole("button", { name: "Remove Sophia from family" })).toBeInTheDocument()
  })

  it("shows a plain message instead of a remove button for the account holder", async () => {
    renderPage()
    expect(await screen.findByTestId("primary-keep")).toHaveTextContent("The account holder can't be removed from the family.")
    expect(screen.queryByRole("button", { name: /Remove Marc/ })).toBeNull()
  })

  it("shows the server's message if a removal is refused", async () => {
    const user = userEvent.setup()
    responder = (c) => (c.method === "DELETE" ? { status: 422, body: { detail: "The account holder cannot be removed." } } : null)
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await user.click(screen.getByRole("button", { name: "Remove Sophia from family" }))
    await user.click(screen.getByRole("button", { name: "Yes, remove Sophia" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("The account holder cannot be removed.")
    expect(screen.getByTestId("node-m-maya")).toBeInTheDocument()
  })
})
