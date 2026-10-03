import { useEffect, useState } from 'react'
import { api } from './api'
import { t } from './i18n'
import { useCtx } from './School'

type A = { id: string; action: string; actor: string | null; entity: string | null; meta: unknown; createdAt: string }
const LIMIT = 50

export function Audit() {
  const { school } = useCtx()
  const [rows, setRows] = useState<A[]>([])
  const [filter, setFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [err, setErr] = useState('')
  useEffect(() => {
    api<A[]>(`/${school}/audit?limit=${LIMIT}&offset=${offset}${filter ? `&action=${encodeURIComponent(filter)}` : ''}`).then((d) => { setRows(d); setErr('') }, (e) => setErr(e.message))
  }, [school, filter, offset])
  return (
    <main id="main">
      <h1>{t('audit')}</h1>
      <div className="card">
        <label style={{ maxWidth: 260, marginBottom: 12 }}>Show
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0) }}>
            <option value="">Everything</option>
            {['user', 'student', 'teacher', 'login', 'school', 'impersonation'].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="table-wrap"><table>
          <caption className="sr-only">Recent activity</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actor ?? 'system'}</td><td>{r.action}</td>
                <td className="muted">{r.meta ? JSON.stringify(r.meta) : ''}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="muted">{t('nothing')}</td></tr>}
          </tbody>
        </table></div>
        <p style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="link" style={{ color: 'var(--accent)' }} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>{t('previous')}</button>
          <button type="button" className="link" style={{ color: 'var(--accent)' }} disabled={rows.length < LIMIT} onClick={() => setOffset(offset + LIMIT)}>{t('next')}</button>
        </p>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </main>
  )
}
