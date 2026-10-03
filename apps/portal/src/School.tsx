import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, ApiError } from './api'

export type Config = { schoolId: string; slug: string; name: string; locale: string; primaryColor: string | null; logoUrl: string | null }
export type Me = { userId: string; roles: string[] }
export type Ctx = { cfg: Config; me: Me | null; school: string }
export const useCtx = () => useOutletContext<Ctx>()

const RTL = ['ar', 'he', 'fa', 'ur']

export function SchoolLayout() {
  const { school = '' } = useParams()
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [cfg, setCfg] = useState<Config | null>(null)
  const [error, setError] = useState('')
  const [me, setMe] = useState<Me | null | undefined>(undefined)

  useEffect(() => {
    api<Config>(`/${school}/config`).then(setCfg, (e: ApiError) =>
      setError(e.message === 'school_suspended' ? 'This school is suspended. Contact the school office.' : 'School not found.'),
    )
  }, [school])

  const loadMe = useCallback(() => api<Me>(`/${school}/me`).then(setMe, () => setMe(null)), [school])
  useEffect(() => { loadMe() }, [loadMe, pathname === `/${school}/login`])

  // Branding comes from the school, not the build.
  useEffect(() => {
    if (!cfg) return
    if (cfg.primaryColor) document.documentElement.style.setProperty('--accent', cfg.primaryColor)
    document.documentElement.dir = RTL.includes(cfg.locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = cfg.locale
    document.title = cfg.name
  }, [cfg])

  const onLogin = pathname === `/${school}/login`
  useEffect(() => { if (me === null && !onLogin) nav(`/${school}/login`, { replace: true }) }, [me, onLogin, nav, school])

  if (error) return <main className="center card"><p className="err">{error}</p></main>
  if (!cfg || me === undefined) return <main><p className="muted">Loading…</p></main>
  if (me === null && !onLogin) return null

  const logout = async () => { await api('/auth/sign-out', { method: 'POST', body: {} }).catch(() => {}); setMe(null) }
  return (
    <>
      <header className="bar">
        {cfg.logoUrl && <img src={cfg.logoUrl} alt="" />}
        <strong><Link to={`/${school}`} style={{ color: 'inherit', textDecoration: 'none' }}>{cfg.name}</Link></strong>
        {me && <button className="link" style={{ color: 'inherit' }} onClick={logout}>Sign out</button>}
      </header>
      <Outlet context={{ cfg, me, school } satisfies Ctx} />
    </>
  )
}

export function Login() {
  const { school, cfg } = useCtx()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      await api(`/${school}/login`, { body: { identifier: f.get('identifier'), password: f.get('password') } })
      nav(`/${school}`)
    } catch (x) { setErr(x instanceof ApiError && x.status === 429 ? 'Too many attempts. Try again later.' : 'Wrong email, username or password.') }
    setBusy(false)
  }
  return (
    <main className="center card">
      <h1>Sign in to {cfg.name}</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>Email or username<input name="identifier" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </main>
  )
}

export function Dashboard() {
  const { school, cfg, me } = useCtx()
  const staff = me?.roles.some((r) => r === 'principal' || r === 'admin')
  return (
    <main>
      <h1>Welcome to {cfg.name}</h1>
      <p className="muted">Signed in as {me?.roles.join(', ')}.</p>
      {staff && <p><Link to={`/${school}/setup`}>School setup: years, terms, grades, sections, subjects</Link></p>}
      {me?.roles.some((r) => ['principal', 'admin', 'teacher'].includes(r)) && <p><Link to={`/${school}/people`}>People: students, teachers, guardians</Link></p>}
    </main>
  )
}
