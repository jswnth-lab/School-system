import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from './api'
import { useCtx } from './School'
import { t } from './i18n'

type Row = Record<string, any>
type Cred = { who: string; identifier: string; password: string }
const TABS = ['students', 'teachers', 'guardians'] as const
const LIMIT = 50

export function People() {
  const { school, me } = useCtx()
  const canWrite = me?.roles.some((r) => r === 'principal' || r === 'admin')
  const [tab, setTab] = useState<(typeof TABS)[number]>('students')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState('')
  const [cred, setCred] = useState<Cred | null>(null)
  const base = `/${school}/people`

  const load = useCallback(async () => {
    try {
      if (tab === 'students') {
        const d = await api(`${base}/students?limit=${LIMIT}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        setRows(d.rows); setTotal(d.total)
      } else { const d = await api(`${base}/${tab}`); setRows(d); setTotal(d.length) }
      setErr('')
    } catch (e) { setErr((e as Error).message) }
  }, [base, tab, offset, q])
  useEffect(() => { load() }, [load])

  const add = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const body = Object.fromEntries([...new FormData(form)].filter(([, v]) => v !== ''))
    try { await api(`${base}/${tab}`, { body }); form.reset(); await load() } catch (x) { setErr(x instanceof ApiError ? x.message : 'failed') }
  }
  const del = async (id: string) => {
    if (!window.confirm('Delete this person and their records?')) return
    try { await api(`${base}/${tab}/${id}`, { method: 'DELETE' }); await load() } catch (x) { setErr((x as Error).message) }
  }
  const provision = async (r: Row) => {
    try {
      const d = await api(`${base}/${tab}/${r.id}/login`, { method: 'POST', body: {} })
      setCred({ who: r.name ?? `${r.firstName} ${r.lastName}`, ...d }); await load()
    } catch (x) { setErr((x as Error).message) }
  }

  const reset = async (r: Row) => {
    if (!window.confirm('Reset this password? They are signed out everywhere.')) return
    try {
      const d = await api(`${base}/${tab}/${r.id}/reset-password`, { method: 'POST', body: {} })
      setCred({ who: r.name ?? `${r.firstName} ${r.lastName}`, identifier: r.admissionNo ?? r.employeeNo ?? r.email ?? r.phone, password: d.password })
    } catch (x) { setErr((x as Error).message) }
  }

  const cols: Record<string, [string, (r: Row) => string][]> = {
    students: [['Admission no', (r) => r.admissionNo], ['Name', (r) => `${r.firstName} ${r.lastName}`], ['Class', (r) => (r.grade ? `${r.grade} ${r.section}` : '')]],
    teachers: [['Employee no', (r) => r.employeeNo], ['Name', (r) => `${r.firstName} ${r.lastName}`], ['Email', (r) => r.email ?? '']],
    guardians: [['Name', (r) => r.name], ['Email', (r) => r.email ?? ''], ['Phone', (r) => r.phone ?? '']],
  }
  const fields: Record<string, [string, string, boolean?][]> = {
    students: [['admissionNo', 'Admission no', true], ['firstName', 'First name', true], ['lastName', 'Last name', true]],
    teachers: [['employeeNo', 'Employee no', true], ['firstName', 'First name', true], ['lastName', 'Last name', true], ['email', 'Email']],
    guardians: [['name', 'Name', true], ['email', 'Email'], ['phone', 'Phone']],
  }

  return (
    <main id="main">
      <h1>{t('people')}</h1>
      <nav className="tabs" aria-label="People">
        {TABS.map((x) => <button key={x} type="button" aria-pressed={tab === x} onClick={() => { setTab(x); setOffset(0); setQ('') }}>{t(x)}</button>)}
        {canWrite && <Link to={`/${school}/import`} style={{ marginInlineStart: 'auto' }}>Import from CSV</Link>}
      </nav>
      {cred && (
        <div className="card" role="status" style={{ marginBottom: 16 }}>
          <strong>Login created for {cred.who}</strong>
          <p>Username: <code>{cred.identifier}</code> &nbsp; Password: <code>{cred.password}</code></p>
          <p className="muted">This password is shown once. Give it to them now.</p>
          <button className="link" style={{ color: 'inherit' }} onClick={() => setCred(null)}>Dismiss</button>
        </div>
      )}
      <div className="card">
        {tab === 'students' && (
          <label style={{ maxWidth: 320, marginBottom: 12 }}>{t('search')}<input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0) }} placeholder="Name or admission no" /></label>
        )}
        <div className="table-wrap">
          <table>
            <caption className="sr-only">{t(tab)}</caption>
            <thead><tr>{cols[tab].map(([h]) => <th key={h} scope="col">{h}</th>)}<th scope="col">{t('login')}</th>{canWrite && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {cols[tab].map(([h, f]) => <td key={h}>{f(r)}</td>)}
                  <td>{r.userId ? (<><span className="pill">{t('active')}</span>{canWrite && <button type="button" className="link" style={{ color: 'var(--accent)', marginInlineStart: 8 }} onClick={() => reset(r)}>{t('resetPassword')}</button>}</>) : canWrite ? <button type="button" className="link" style={{ color: 'var(--accent)' }} onClick={() => provision(r)}>{t('createLogin')}</button> : ''}</td>
                  {canWrite && <td><button type="button" className="link" onClick={() => del(r.id)}>{t('delete')}</button></td>}
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="muted">{t('nothing')}</td></tr>}
            </tbody>
          </table>
        </div>
        {tab === 'students' && total > LIMIT && (
          <p className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            <button className="link" style={{ color: 'var(--accent)' }} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>{t('previous')}</button>
            <button className="link" style={{ color: 'var(--accent)' }} disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>{t('next')}</button>
          </p>
        )}
        {canWrite && (
          <form className="row" onSubmit={add}>
            {fields[tab].map(([k, l, req]) => <label key={k}>{l}<input name={k} required={req} type={k === 'email' ? 'email' : 'text'} /></label>)}
            <button className="primary">{t('add')}</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </main>
  )
}
