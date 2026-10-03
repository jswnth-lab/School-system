import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'
import { t } from './i18n'
import { useCtx } from './School'

export type Field = { key: string; label: string; type?: 'text' | 'date' | 'number' | 'checkbox' | 'ref'; ref?: string; required?: boolean }
export type Row = Record<string, any>

/** A person/place/thing label for pickers and tables. */
export const labelOf = (r: Row) =>
  r.label ?? r.name ?? (r.admissionNo ? `${r.admissionNo} ${r.firstName} ${r.lastName}` : r.firstName ? `${r.firstName} ${r.lastName}` : '')

/** List endpoints return an array, or { rows } when paged. */
export const rowsOf = (d: any): Row[] => (Array.isArray(d) ? d : d.rows)

/** Table + add form over a tenant REST path like /structure/rooms. Fields of type "ref" pick from another path. */
export function Crud({ title, path, fields }: { title: string; path: string; fields: Field[] }) {
  const { school, me } = useCtx()
  const canWrite = me?.roles.some((r) => r === 'principal' || r === 'admin')
  const base = `/${school}`
  const [rows, setRows] = useState<Row[]>([])
  const [refs, setRefs] = useState<Record<string, Row[]>>({})
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setRows(rowsOf(await api(`${base}${path}`)))
    for (const f of fields) if (f.ref) api(`${base}${f.ref}`).then((d) => setRefs((r) => ({ ...r, [f.ref!]: rowsOf(d) })))
  }, [base, path, fields])
  useEffect(() => { load().catch((e) => setErr(e.message)) }, [load])

  const show = (f: Field, v: any) => (f.type === 'ref' ? labelOf(refs[f.ref!]?.find((x) => x.id === v) ?? {}) : f.type === 'checkbox' ? (v ? '✓' : '') : (v ?? ''))
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
    if (!window.confirm(t('confirmDelete'))) return
    try { await api(`${base}${path}/${id}`, { method: 'DELETE' }); await load() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <div className="card">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{title}</caption>
            <thead><tr>{fields.map((f) => <th key={f.key} scope="col">{f.label}</th>)}{canWrite && <td />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {fields.map((f) => <td key={f.key}>{show(f, r[f.key])}</td>)}
                  {canWrite && <td><button type="button" className="link" onClick={() => del(r.id)}>{t('delete')}</button></td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={fields.length + 1} className="muted">{t('nothing')}</td></tr>}
            </tbody>
          </table>
        </div>
        {canWrite && (
          <form className="row" onSubmit={add}>
            {fields.map((f) =>
              f.type === 'ref' ? (
                <label key={f.key}>{f.label}<select name={f.key} required={f.required}>
                  <option value="">{t('select')}</option>
                  {refs[f.ref!]?.map((o) => <option key={o.id} value={o.id}>{labelOf(o)}</option>)}
                </select></label>
              ) : (
                <label key={f.key} style={f.type === 'checkbox' ? { flexDirection: 'row', alignItems: 'center' } : undefined}>
                  {f.label}<input name={f.key} type={f.type ?? 'text'} required={f.required} />
                </label>
              ),
            )}
            <button className="primary">{t('add')}</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </section>
  )
}
