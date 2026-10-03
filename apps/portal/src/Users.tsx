import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'
import { t } from './i18n'
import { useCtx } from './School'

type U = { userId: string; name: string; identifier: string; roles: string[] }
const ROLES = ['principal', 'admin', 'teacher', 'student', 'parent']

/** Who can sign in to this school. Staff accounts are created here; students, teachers and guardians get logins from People. */
export function Users() {
  const { school, me } = useCtx()
  const isPrincipal = me?.roles.includes('principal')
  const [users, setUsers] = useState<U[]>([])
  const [err, setErr] = useState('')
  const load = useCallback(() => api<U[]>(`/${school}/users`).then(setUsers, (e) => setErr(e.message)), [school])
  useEffect(() => { load() }, [load])

  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      await api(`/${school}/users`, { body: { name: f.get('name'), role: f.get('role'), email: f.get('email'), password: f.get('password') } })
      form.reset(); setErr(''); await load()
    } catch (x) { setErr(x instanceof ApiError ? (x.status === 403 ? 'Only a principal can create principals and admins.' : x.message) : 'failed') }
  }
  const revoke = async (u: U) => {
    if (!window.confirm(`Remove ${u.name}'s access to this school?`)) return
    try { await api(`/${school}/users/${u.userId}`, { method: 'DELETE' }); await load() } catch (x) { setErr((x as Error).message) }
  }

  return (
    <main id="main">
      <h1>{t('users')}</h1>
      <div className="card">
        <div className="table-wrap"><table>
          <caption className="sr-only">People who can sign in</caption>
          <thead><tr><th scope="col">{t('name')}</th><th scope="col">{t('login')}</th><th scope="col">Roles</th>{isPrincipal && <td />}</tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId}><td>{u.name}</td><td>{u.identifier}</td><td>{u.roles.join(', ')}</td>
                {isPrincipal && <td>{u.userId !== me?.userId && <button type="button" className="link" onClick={() => revoke(u)}>Remove access</button>}</td>}</tr>
            ))}
          </tbody>
        </table></div>
        <h2>Add a staff account</h2>
        <form className="row" onSubmit={create}>
          <label>{t('name')}<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>Role<select name="role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Temporary password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
          <button className="primary">{t('add')}</button>
        </form>
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </main>
  )
}
