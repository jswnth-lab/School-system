import { useRef, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'
import { Crud, type Field } from './Kit'
import { LOCALES, t } from './i18n'
import { useCtx } from './School'

const TABS = ['Academic years', 'Grades and sections', 'Subjects and rooms', 'Branding'] as const
const years: Field[] = [
  { key: 'name', label: 'Name', required: true }, { key: 'startDate', label: 'Start', type: 'date' },
  { key: 'endDate', label: 'End', type: 'date' }, { key: 'current', label: 'Current', type: 'checkbox' },
]
const terms: Field[] = [
  { key: 'academicYearId', label: 'Year', type: 'ref', ref: '/structure/years', required: true }, { key: 'name', label: 'Term', required: true },
  { key: 'startDate', label: 'Start', type: 'date' }, { key: 'endDate', label: 'End', type: 'date' },
]
const grades: Field[] = [{ key: 'name', label: 'Grade', required: true }, { key: 'position', label: 'Order', type: 'number' }]
const sections: Field[] = [{ key: 'gradeLevelId', label: 'Grade', type: 'ref', ref: '/structure/grades', required: true }, { key: 'name', label: 'Section', required: true }]
const subjects: Field[] = [{ key: 'name', label: 'Subject', required: true }, { key: 'code', label: 'Code' }]
const rooms: Field[] = [{ key: 'name', label: 'Room', required: true }, { key: 'capacity', label: 'Capacity', type: 'number' }]

function Branding() {
  const { cfg, school } = useCtx()
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    try {
      await api(`/${school}/branding`, { method: 'PATCH', body: { name: f.get('name'), primaryColor: f.get('primaryColor'), locale: f.get('locale') } })
      const logo = file.current?.files?.[0]
      if (logo) {
        const r = await fetch(`/api/v1/${school}/branding/logo`, { method: 'PUT', headers: { 'content-type': logo.type }, body: logo })
        if (!r.ok) throw new ApiError(r.status, ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'logo upload failed')
      }
      setMsg('Saved. Reloading…'); setTimeout(() => location.reload(), 600)
    } catch (x) { setMsg(x instanceof ApiError ? x.message : 'failed') }
  }
  return (
    <section aria-label="Branding">
      <h2>Branding</h2>
      <form className="card" onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
        <label>School name<input name="name" defaultValue={cfg.name} required /></label>
        <label>Brand color<input name="primaryColor" type="color" defaultValue={cfg.primaryColor ?? '#2457d6'} /></label>
        <label>Language<select name="locale" defaultValue={cfg.locale}>{LOCALES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>Logo (PNG, JPEG or WebP, up to 512 KB)<input ref={file} type="file" accept="image/png,image/jpeg,image/webp" /></label>
        <button className="primary">{t('save')}</button>
        {msg && <p role="status" className="muted">{msg}</p>}
      </form>
    </section>
  )
}

export function Setup() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0])
  return (
    <main id="main">
      <h1>{t('setup')}</h1>
      <nav className="tabs" aria-label="Setup sections">
        {TABS.map((x) => <button key={x} type="button" aria-pressed={tab === x} onClick={() => setTab(x)}>{x}</button>)}
      </nav>
      {tab === TABS[0] && <><Crud title="Academic years" path="/structure/years" fields={years} /><Crud title="Terms" path="/structure/terms" fields={terms} /></>}
      {tab === TABS[1] && <><Crud title="Grades" path="/structure/grades" fields={grades} /><Crud title="Sections" path="/structure/sections" fields={sections} /></>}
      {tab === TABS[2] && <><Crud title="Subjects" path="/structure/subjects" fields={subjects} /><Crud title="Rooms" path="/structure/rooms" fields={rooms} /></>}
      {tab === TABS[3] && <Branding />}
    </main>
  )
}
