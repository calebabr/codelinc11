import { useEffect, useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { CategoryChip } from '@/components/CategoryChip'
import { Skeleton } from '@/components/StateViews'
import { errorMessage, searchProcedures } from '@/lib/api'
import type { Procedure } from '@/lib/types'

const SUGGESTIONS = ['cleaning', 'filling', 'crown', 'root canal']

export function ProcedureSearch({
  onSelect,
  placeholder = 'Describe it in your own words: "crown", "cap on my back tooth"…',
}: {
  onSelect: (p: Procedure) => void
  placeholder?: string
}) {
  const inputId = useId()
  const listId = useId()
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 200)
    return () => clearTimeout(t)
  }, [text])

  const q = useQuery({
    queryKey: ['procedures', debounced],
    queryFn: () => searchProcedures(debounced),
    enabled: debounced.length > 0,
  })

  function choose(p: Procedure) {
    setText(p.name)
    setOpen(false)
    onSelect(p)
  }

  const showList = open && debounced.length > 0

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        What dental work are you thinking about?
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          className="h-14 pl-10 text-base md:text-lg"
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
        {showList && (
          <div
            id={listId}
            role="listbox"
            aria-label="Matching procedures"
            className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
          >
            {q.isLoading && (
              <div className="space-y-2 p-2">
                <Skeleton className="h-8" />
                <Skeleton className="h-8" />
              </div>
            )}
            {q.isError && <p className="p-3 text-sm text-destructive">{errorMessage(q.error)}</p>}
            {q.data && q.data.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No matches. Try a simpler word like "filling" or "crown".
              </p>
            )}
            {q.data?.map(({ procedure: p }) => (
              <button
                key={p.code}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => choose(p)}
                className="flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <CategoryChip category={p.category} />
                  <span className="text-xs text-muted-foreground">{p.code}</span>
                </span>
                {p.description && <span className="text-xs text-muted-foreground">{p.description}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Try:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border px-3 py-1 hover:bg-muted"
            onClick={() => {
              setText(s)
              setOpen(true)
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
