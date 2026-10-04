import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { ApiError } from "@/lib/api/planYear"
import { ErrorNote } from "@/components/ErrorNote"
import { errorMessage, getOutbox, getPrefs, putPrefs, sendTest } from "@/lib/api/notifications"
import type { Channel, NotificationPrefs, OutboxItem } from "@/lib/types/notifications"
import { formatDate } from "@/lib/format"
import { announceNotificationsChanged } from "./useNotifications"
import { KIND_CHOICES } from "./kinds"

const CHANNELS: { id: Channel; label: string }[] = [
  { id: "app", label: "App" },
  { id: "email", label: "Email" },
  { id: "sms", label: "Text message" },
]

const ALL_KINDS = KIND_CHOICES.map((k) => k.kind)

function Switch({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-2 text-left font-semibold transition-colors disabled:opacity-60 ${
        on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white text-ink"
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${on ? "bg-white text-burgundy" : "bg-track text-muted-foreground"}`}>
        {on ? "On" : "Off"}
      </span>
    </button>
  )
}

export function NotificationSettings({ token, memberId, firstName }: { token: string; memberId: string; firstName: string }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testNote, setTestNote] = useState<string | null>(null)

  const loadOutbox = useCallback(async () => {
    try {
      setOutbox(await getOutbox(token, memberId))
    } catch {
      setOutbox([])
    }
  }, [token, memberId])

  useEffect(() => {
    let cancelled = false
    setPrefs(null)
    setLoadError(null)
    setSaveError(null)
    setReadOnly(false)
    setTestNote(null)
    getPrefs(token, memberId).then(
      (p) => !cancelled && setPrefs(p),
      (e) => !cancelled && setLoadError(errorMessage(e)),
    )
    void loadOutbox()
    return () => {
      cancelled = true
    }
  }, [token, memberId, loadOutbox])

  const save = async (next: NotificationPrefs) => {
    setBusy(true)
    setSaveError(null)
    try {
      const saved = await putPrefs(token, memberId, next)
      setPrefs(saved && typeof saved.app === "boolean" ? saved : next)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setReadOnly(true)
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleChannel = (ch: Channel) => {
    if (!prefs || readOnly) return
    void save({ ...prefs, [ch]: !prefs[ch] })
  }

  const toggleKind = (kind: string) => {
    if (!prefs || readOnly) return
    const current = prefs.types ?? ALL_KINDS
    const next = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]
    const all = ALL_KINDS.every((k) => next.includes(k))
    void save({ ...prefs, types: all ? null : next })
  }

  const runTest = async (ch: Channel) => {
    setBusy(true)
    setTestNote(null)
    setSaveError(null)
    try {
      await sendTest(token, memberId, ch)
      setTestNote(
        ch === "app"
          ? "A test notification was added to the bell."
          : `A ${ch === "email" ? "test email" : "test text message"} preview was added below. Nothing was sent.`,
      )
      await loadOutbox()
      announceNotificationsChanged()
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setReadOnly(true)
      setSaveError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const missing = (ch: Channel) =>
    ch === "email" ? (prefs ? !prefs.email_on_file : false) : ch === "sms" ? (prefs ? !prefs.phone_on_file : false) : false

  return (
    <section id="settings" aria-labelledby="notif-settings" className="portal-card scroll-mt-4">
      <h2 id="notif-settings" className="portal-card-title">
        Settings for {firstName}
      </h2>

      {loadError && <ErrorNote className="note mt-3" message={loadError} />}
      {!prefs && !loadError && (
        <p role="status" className="mt-3 text-muted-foreground">
          Loading settings…
        </p>
      )}

      {readOnly && (
        <p role="status" className="note mt-3">
          {saveError ?? "These settings can't be changed in the shared demo family."} The settings are read-only here.
        </p>
      )}
      {saveError && !readOnly && (
        <p role="alert" className="mt-3 text-burgundy">
          {saveError}
        </p>
      )}

      {prefs && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Choose how {firstName} hears about things.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {CHANNELS.map((c) => (
              <div key={c.id}>
                <Switch label={c.label} on={prefs[c.id]} disabled={busy || readOnly} onClick={() => toggleChannel(c.id)} />
                {c.id === "email" && missing("email") && (
                  <p className="mt-1 text-sm">
                    No email on file.{" "}
                    <Link to="/family" className="font-semibold text-burgundy underline">
                      Add one on the Family page
                    </Link>
                  </p>
                )}
                {c.id === "sms" && missing("sms") && (
                  <p className="mt-1 text-sm">
                    No phone on file.{" "}
                    <Link to="/family" className="font-semibold text-burgundy underline">
                      Add one on the Family page
                    </Link>
                  </p>
                )}
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-semibold">Which alerts to get</h3>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Which alerts to get">
            {KIND_CHOICES.map((k) => {
              const on = prefs.types == null || prefs.types.includes(k.kind)
              return (
                <button
                  key={k.kind}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  disabled={busy || readOnly}
                  onClick={() => toggleKind(k.kind)}
                >
                  {k.label}
                </button>
              )
            })}
          </div>

          <h3 className="mt-6 font-semibold">Send me a test</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn btn-outline"
                disabled={busy || readOnly}
                onClick={() => void runTest(c.id)}
              >
                Send me a test {c.id === "app" ? "notification" : c.id === "email" ? "email" : "text"}
              </button>
            ))}
          </div>
          {testNote && (
            <p role="status" className="mt-2 text-sm">
              {testNote}
            </p>
          )}
        </>
      )}

      <h3 className="mt-6 font-semibold">Delivery preview</h3>
      <p className="note mt-2" data-testid="outbox-banner">
        Demo only: emails and text messages are previews. Nothing is sent.
      </p>
      {outbox.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No previews yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {outbox.map((o) => (
            <li key={o.id} className="py-3" data-testid="outbox-item">
              <p className="flex flex-wrap items-center gap-2">
                <span className="chip chip-pending">{o.channel === "sms" ? "Text message" : "Email"} preview</span>
                <span className="text-sm text-muted-foreground">
                  To {o.to_address} · {formatDate(o.created_at)}
                </span>
              </p>
              <p className="mt-1 font-semibold">{o.subject}</p>
              <p className="text-sm">{o.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
