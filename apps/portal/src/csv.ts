/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF, BOM. Returns rows keyed by normalized header. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const out: string[][] = []
  let row: string[] = [], field = '', q = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c.trim() !== '')) out.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) out.push(row)
  const headers = (out.shift() ?? []).map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'))
  return { headers, rows: out.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) }
}
