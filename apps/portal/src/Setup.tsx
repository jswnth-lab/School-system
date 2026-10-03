import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'
import { useCtx } from './School'

type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'checkbox' | 'ref'; ref?: string; required?: boolean }
type Row = Record<string, any>

function Crud({ title, path, fields }: { title: string; path: string; fields: Field[] }) {
  const { school, me } = useCtx()
  const canWrite = me?.roles.some((r) => r === 'principal' || r === 'admin')
  const base = `/${school}/structure`
  const [rows, setRows] = useState<Row[]>([])
  const [refs, setRefs] = useState<Record<string, Row[]>>({})
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setRows(await api(`${base}${path}`))
    for (const f of fields) if (f.ref) setRefs((r) => ({ ...r, [f.ref!]: [] }))
    for (const f of fields) if (f.ref) api(`${base}${f.ref}`).then((d) => setRefs((r) => ({ ...r, [f.ref!]: d })))
  }, [base, path, fields])
  useEffect(() => { load().catch((e) => setErr(e.message)) }, [load])

  const label = (f: Field, v: any) => (f.type === 'ref' ? refs[f.ref!]?.find((x) => x.id === v)?.name ?? '' : f.type === 'checkbox' ? (v ? 'Yes' : '') : (v ?? ''))
  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    const body: Row = {}
    for (const f of fields) {
      const v = fd.get(f.key)
      if (f.type === 'checkbox') body[f.key] = v === 'on'
      else if (v !== null && v !== '') body[f.key] = f.type === 'number' ? Number(v) : v
    }
    try { await api(`${base}${path}`, { body }); form.reset(); setErr(''); await load() }
    catch (x) { setErr(x instanceof ApiError ? x.message : 'failed') }
  }
  const del = async (id: string) => {
    if (!window.confirm('Delete this item? Anything under it is deleted too.')) return
    try { await api(`${base}${path}/${id}`, { method: 'DELETE' }); await load() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <section>
      <h2>{title}</h2>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}{canWrite && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {fields.map((f) => <td key={f.key}>{label(f, r[f.key])}</td>)}
                  {canWrite && <td><button className="link" onClick={() => del(r.id)}>Delete</button></td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={fields.length + 1} className="muted">Nothing here yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {canWrite && (
          <form className="row" onSubmit={add}>
            {fields.map((f) =>
              f.type === 'ref' ? (
                <label key={f.key}>{f.label}<select name={f.key} required={f.required}>
                  <option value="">Select…</option>
                  {refs[f.ref!]?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select></label>
              ) : (
                <label key={f.key} style={f.type === 'checkbox' ? { flexDirection: 'row', alignItems: 'center' } : undefined}>
                  {f.label}<input name={f.key} type={f.type ?? 'text'} required={f.required} />
                </label>
              ),
            )}
            <button className="primary">Add</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </section>
  )
}

const TABS = ['Academic years', 'Grades and sections', 'Subjects'] as const
const years: Field[] = [
  { key: 'name', label: 'Name', required: true }, { key: 'startDate', label: 'Start', type: 'date' },
  { key: 'endDate', label: 'End', type: 'date' }, { key: 'current', label: 'Current', type: 'checkbox' },
]
const terms: Field[] = [
  { key: 'academicYearId', label: 'Year', type: 'ref', ref: '/years', required: true }, { key: 'name', label: 'Term', required: true },
  { key: 'startDate', label: 'Start', type: 'date' }, { key: 'endDate', label: 'End', type: 'date' },
]
const grades: Field[] = [{ key: 'name', label: 'Grade', required: true }, { key: 'position', label: 'Order', type: 'number' }]
const sections: Field[] = [{ key: 'gradeLevelId', label: 'Grade', type: 'ref', ref: '/grades', required: true }, { key: 'name', label: 'Section', required: true }]
const subjects: Field[] = [{ key: 'name', label: 'Subject', required: true }, { key: 'code', label: 'Code' }]

export function Setup() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0])
  return (
    <main>
      <h1>School setup</h1>
      <nav className="tabs">
        {TABS.map((t) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}
      </nav>
      {tab === TABS[0] && <><Crud title="Academic years" path="/years" fields={years} /><Crud title="Terms" path="/terms" fields={terms} /></>}
      {tab === TABS[1] && <><Crud title="Grades" path="/grades" fields={grades} /><Crud title="Sections" path="/sections" fields={sections} /></>}
      {tab === TABS[2] && <Crud title="Subjects" path="/subjects" fields={subjects} />}
    </main>
  )
}
