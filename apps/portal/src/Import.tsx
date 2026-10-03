import { useState, type ChangeEvent } from 'react'
import { parseCsv } from './csv'
import { useCtx } from './School'

const KINDS = {
  students: {
    label: 'Students', required: ['admission_no', 'first_name', 'last_name'],
    all: ['admission_no', 'first_name', 'last_name', 'dob', 'gender', 'grade', 'section', 'roll_no', 'guardian_name', 'guardian_email', 'guardian_phone', 'guardian_relationship'],
    sample: 'S1001,Asha,Rao,2015-03-02,female,Grade 5,A,1,Mr Rao,rao@example.com,+911234567890,father',
    key: 'admission_no',
  },
  teachers: {
    label: 'Teachers', required: ['employee_no', 'first_name', 'last_name'],
    all: ['employee_no', 'first_name', 'last_name', 'email', 'phone'], sample: 'T01,Tina,Roy,tina@example.com,+911234567890', key: 'employee_no',
  },
} as const
type Kind = keyof typeof KINDS
type Err = { line: number; field?: string; message: string }
const CHUNK = 200 // matches the API limit

export function Import() {
  const { school } = useCtx()
  const [kind, setKind] = useState<Kind>('students')
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [errors, setErrors] = useState<Err[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const k = KINDS[kind]

  const template = () => {
    const url = URL.createObjectURL(new Blob([`${k.all.join(',')}\n${k.sample}\n`], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: `${kind}-template.csv` }).click()
    URL.revokeObjectURL(url)
  }
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    setErrors([]); setStatus(''); setRows(null)
    const f = e.target.files?.[0]
    if (!f) return
    const { headers, rows } = parseCsv(await f.text())
    const missing = k.required.filter((h) => !headers.includes(h))
    if (missing.length) return setStatus(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template for the expected headers.`)
    if (!rows.length) return setStatus('The file has no data rows.')
    setRows(rows); setStatus(`${rows.length} rows read. Check the file before importing.`)
  }

  // send in chunks; dryRun validates only. Line numbers are CSV lines (header is line 1).
  const send = async (dryRun: boolean) => {
    if (!rows) return
    setBusy(true); setErrors([])
    const found: Err[] = []
    const seen = new Map<string, number>()
    rows.forEach((r, i) => { // duplicates across chunks
      const v = r[k.key]
      if (v) { if (seen.has(v)) found.push({ line: i + 2, field: k.key, message: `duplicate of line ${seen.get(v)}` }); else seen.set(v, i + 2) }
    })
    try {
      for (let s = 0; s < rows.length; s += CHUNK) {
        setStatus(`${dryRun ? 'Checking' : 'Importing'} ${Math.min(s + CHUNK, rows.length)} of ${rows.length}…`)
        const r = await fetch(`/api/v1/${school}/import/${kind}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: rows.slice(s, s + CHUNK), dryRun }),
        })
        const d = await r.json().catch(() => ({}))
        if (r.status === 422) found.push(...d.errors.map((e: { row: number; field?: string; message: string }) => ({ line: s + e.row + 2, field: e.field, message: e.message })))
        else if (!r.ok) throw new Error(d.error ?? `failed (${r.status})`)
        if (!dryRun && found.length) break
      }
      found.sort((a, b) => a.line - b.line)
      setErrors(found)
      setStatus(found.length ? `${found.length} problem${found.length > 1 ? 's' : ''} found. Fix the file and choose it again. Nothing was imported.`
        : dryRun ? `All ${rows.length} rows look good. Ready to import.` : `Imported ${rows.length} rows.`)
      if (!dryRun && !found.length) setRows(null)
    } catch (x) { setStatus((x as Error).message) }
    setBusy(false)
  }

  return (
    <main>
      <h1>Import from CSV</h1>
      <div className="card">
        <nav className="tabs">
          {(Object.keys(KINDS) as Kind[]).map((x) => (
            <button key={x} aria-pressed={kind === x} onClick={() => { setKind(x); setRows(null); setErrors([]); setStatus('') }}>{KINDS[x].label}</button>
          ))}
        </nav>
        <p className="muted">
          Columns: {k.all.join(', ')}. Required: {k.required.join(', ')}. Importing the same admission/employee number again updates that person.
          {kind === 'students' && ' Grade and section must already exist; students join the current academic year.'}
        </p>
        <div className="row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="primary" type="button" onClick={template}>Download template</button>
          <label>CSV file<input type="file" accept=".csv,text/csv" onChange={pick} /></label>
        </div>
        {status && <p role="status" className={errors.length ? 'err' : 'muted'}>{status}</p>}
        {rows && !busy && (
          <p style={{ display: 'flex', gap: 8 }}>
            <button className="primary" onClick={() => send(true)}>Check file</button>
            {!errors.length && status.startsWith('All') && <button className="primary" onClick={() => send(false)}>Import {rows.length} rows</button>}
          </p>
        )}
        {errors.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Line</th><th>Column</th><th>Problem</th></tr></thead>
              <tbody>{errors.slice(0, 100).map((e, i) => <tr key={i}><td>{e.line}</td><td>{e.field}</td><td>{e.message}</td></tr>)}</tbody>
            </table>
            {errors.length > 100 && <p className="muted">Showing the first 100.</p>}
          </div>
        )}
      </div>
    </main>
  )
}
