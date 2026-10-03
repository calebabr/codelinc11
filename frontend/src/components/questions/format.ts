import type { QuestionsResponse } from '@/lib/types'

/** Plain-text checklist grouped by section; asked questions are marked [x]. */
export function checklistText(data: QuestionsResponse, asked: Set<string>): string {
  const lines: string[] = ['Questions to ask my dentist', '']
  for (const s of data.sections) {
    lines.push(s.title)
    for (const q of s.questions) lines.push(`[${asked.has(q.id) ? 'x' : ' '}] ${q.text}`)
    lines.push('')
  }
  lines.push(data.safety_note)
  return lines.join('\n')
}
