import { useRef, useState } from "react"
import { addSample, errorMessage, uploadReportText } from "@/lib/api/reports"
import { KIND_LABEL } from "./ReportCard"
import { useSamples } from "./useReports"

const MAX_BYTES = 20 * 1024

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ""))
    r.onerror = () => reject(new Error("We could not read that file."))
    r.readAsText(file)
  })
}

/** Add a synthetic sample with one tap, or paste/upload text in the sample template. */
export function AddDocument({ token, memberId, onAdded }: { token: string; memberId: string; onAdded: () => void }) {
  const samples = useSamples(token)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [filename, setFilename] = useState("pasted.txt")
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function add(id: string, title: string) {
    setBusyId(id)
    setError(null)
    setDone(null)
    try {
      await addSample(token, memberId, id)
      setDone(`Added: ${title}`)
      onAdded()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  async function send() {
    setSending(true)
    setError(null)
    setDone(null)
    try {
      await uploadReportText(token, memberId, text, filename)
      setText("")
      setDone("Added your document.")
      onAdded()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setError(null)
    setDone(null)
    if (file.size > MAX_BYTES) {
      setError("That file is too large. The limit is 20 KB.")
      return
    }
    try {
      setText(await readText(file))
      setFilename(file.name)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <section aria-labelledby="rp-add" className="portal-card space-y-4">
      <div>
        <h2 id="rp-add" className="portal-card-title">Add a document</h2>
        <p className="text-sm text-muted-foreground">Tap a sample to add it, or paste a sample document below.</p>
      </div>

      {samples.loading && <p role="status" className="text-sm">Loading samples...</p>}
      {samples.error && (
        <div role="alert" className="note">
          <p>{samples.error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={samples.retry}>Try again</button>
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Sample documents">
        {samples.list.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void add(s.id, s.title)}
              aria-label={`Add sample: ${s.title}`}
              className="portal-card-select min-h-11 w-full rounded-2xl border border-line bg-white p-3 text-left"
            >
              <span className="block font-semibold text-burgundy">{s.title}</span>
              <span className="block text-xs text-muted-foreground">{KIND_LABEL[s.kind] ?? "Document"} · made-up sample</span>
            </button>
          </li>
        ))}
      </ul>

      <div>
        <label htmlFor="rp-text" className="block text-sm font-semibold">Paste a sample document</label>
        <textarea
          id="rp-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={MAX_BYTES}
          className="mt-1 w-full rounded-2xl border border-line bg-white p-3 font-mono text-base"
          placeholder="MOLAR MONEY SAMPLE DOCUMENT"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            aria-label="Choose a text file"
            data-testid="report-file"
            onChange={(e) => {
              void pick(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <button type="button" className="btn btn-outline" onClick={() => fileRef.current?.click()}>Choose a text file</button>
          <button type="button" className="btn btn-orange" disabled={sending || !text.trim()} onClick={() => void send()}>
            {sending ? "Adding..." : "Add this document"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Only the sample document format is accepted (text, up to 20 KB). Please do not upload real records.</p>
      </div>

      {error && <p role="alert" className="note">{error}</p>}
      {done && <p role="status" className="text-sm font-semibold text-[var(--ok-ink)]">{done}</p>}
    </section>
  )
}
