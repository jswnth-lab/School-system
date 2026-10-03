import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'

type S = { id: string; slug: string; name: string; status: 'active' | 'suspended'; planId: string }

export function Platform() {
  const [schools, setSchools] = useState<S[] | null | undefined>(undefined) // null = signed out
  const [err, setErr] = useState('')
  const load = useCallback(() => api<S[]>('/platform/schools').then(setSchools, (e: ApiError) => { setSchools(null); if (e.status === 403) setErr('This account is not a platform admin.') }), [])
  useEffect(() => { document.title = 'Platform console'; load() }, [load])

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try { await api('/auth/sign-in/email', { body: { email: f.get('email'), password: f.get('password') } }); setErr(''); await load() }
    catch { setErr('Wrong email or password.') }
  }
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      await api('/platform/schools', { body: { slug: f.get('slug'), name: f.get('name'), principal: { name: f.get('pname'), email: f.get('pemail'), password: f.get('ppass') } } })
      form.reset(); setErr(''); await load()
    } catch (x) { setErr(x instanceof ApiError ? x.message : 'failed') }
  }
  const toggle = async (s: S) => {
    await api(`/platform/schools/${s.id}`, { method: 'PATCH', body: { status: s.status === 'active' ? 'suspended' : 'active' } })
    await load()
  }

  if (schools === undefined) return <main><p className="muted">Loading…</p></main>
  if (schools === null)
    return (
      <main className="center card">
        <h1>Platform console</h1>
        <form onSubmit={login} style={{ display: 'grid', gap: 12 }}>
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="primary">Sign in</button>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      </main>
    )
  return (
    <main>
      <h1>Platform console</h1>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>School</th><th>Address</th><th>Plan</th><th>Status</th><th /></tr></thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><a href={`/${s.slug}`}>/{s.slug}</a></td>
                <td>{s.planId}</td>
                <td><span className={s.status === 'suspended' ? 'pill warn' : 'pill'}>{s.status}</span></td>
                <td><button className="link" onClick={() => toggle(s)}>{s.status === 'active' ? 'Suspend' : 'Resume'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>New school</h2>
      <form className="card row" onSubmit={create}>
        <label>School name<input name="name" required /></label>
        <label>Address (slug)<input name="slug" pattern="[a-z0-9][a-z0-9\-]{1,30}[a-z0-9]" required title="lowercase letters, digits, hyphens" /></label>
        <label>Principal name<input name="pname" required /></label>
        <label>Principal email<input name="pemail" type="email" required /></label>
        <label>Temporary password<input name="ppass" type="password" minLength={8} autoComplete="new-password" required /></label>
        <button className="primary">Create school</button>
      </form>
      {err && <p className="err" role="alert">{err}</p>}
    </main>
  )
}
