import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, ApiError } from './api'
import { setLocale, t } from './i18n'

export type Config = { schoolId: string; slug: string; name: string; locale: string; primaryColor: string | null; logoUrl: string | null }
export type Me = { userId: string; roles: string[] }
export type Ctx = { cfg: Config; me: Me | null; school: string }
export const useCtx = () => useOutletContext<Ctx>()

const RTL = ['ar', 'he', 'fa', 'ur']

/** Black or white text, whichever is readable on the brand color (WCAG relative luminance). */
function readableOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111' : '#fff'
}

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

  const onLogin = pathname === `/${school}/login`
  const loadMe = useCallback(() => api<Me>(`/${school}/me`).then(setMe, () => setMe(null)), [school])
  useEffect(() => { loadMe() }, [loadMe, onLogin])

  // Branding comes from the school, not the build.
  useEffect(() => {
    if (!cfg) return
    if (cfg.primaryColor) {
      document.documentElement.style.setProperty('--accent', cfg.primaryColor)
      document.documentElement.style.setProperty('--accent-fg', readableOn(cfg.primaryColor))
    }
    document.documentElement.dir = RTL.includes(cfg.locale) ? 'rtl' : 'ltr'
    document.documentElement.lang = cfg.locale
    document.title = cfg.name
  }, [cfg])

  useEffect(() => { if (me === null && !onLogin) nav(`/${school}/login`, { replace: true }) }, [me, onLogin, nav, school])

  if (cfg) setLocale(cfg.locale) // before children render
  if (error) return <main id="main" className="center card"><p className="err">{error}</p></main>
  if (!cfg || me === undefined) return <main id="main"><p className="muted">{t('loading')}</p></main>
  if (me === null && !onLogin) return null

  const has = (...r: string[]) => !!me?.roles.some((x) => r.includes(x))
  const links: [string, string, boolean][] = [
    ['', t('home'), true], ['classes', t('classes'), has('principal', 'admin', 'teacher')], ['people', t('people'), has('principal', 'admin', 'teacher')],
    ['users', t('users'), has('principal', 'admin')], ['setup', t('setup'), has('principal', 'admin')], ['audit', t('audit'), has('principal', 'admin')],
  ]
  const logout = async () => { await api('/auth/sign-out', { method: 'POST', body: {} }).catch(() => {}); setMe(null) }
  return (
    <>
      <a className="skip" href="#main">{t('skip')}</a>
      <header className="bar">
        {cfg.logoUrl && <img src={cfg.logoUrl} alt="" />}
        <strong><Link to={`/${school}`} style={{ color: 'inherit', textDecoration: 'none' }}>{cfg.name}</Link></strong>
        {me && <nav aria-label="Main">{links.filter(([, , show]) => show).map(([to, label]) => <NavLink key={to} to={`/${school}/${to}`} end={to === ''}>{label}</NavLink>)}</nav>}
        {me && <button type="button" className="link" style={{ color: 'inherit', marginInlineStart: 'auto' }} onClick={logout}>{t('signOut')}</button>}
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
    } catch (x) { setErr(x instanceof ApiError && x.status === 429 ? t('tooMany') : t('wrongLogin')) }
    setBusy(false)
  }
  return (
    <main id="main" className="center card">
      <h1>{t('signIn')} · {cfg.name}</h1>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>{t('identifier')}<input name="identifier" autoComplete="username" required /></label>
        <label>{t('password')}<input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="primary" disabled={busy}>{busy ? t('signingIn') : t('signIn')}</button>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </main>
  )
}

export function Dashboard() {
  const { cfg, me } = useCtx()
  return (
    <main id="main">
      <h1>{t('welcome')} {cfg.name}</h1>
      <p className="muted">{t('signedInAs')} {me?.roles.join(', ')}.</p>
    </main>
  )
}
