import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api'
import { labelOf, rowsOf, type Row } from './Kit'
import { t } from './i18n'
import { useCtx } from './School'

/** One class (section) at a time: who is enrolled this year, and who teaches which subject. */
export function Classes() {
  const { school, me } = useCtx()
  const canWrite = me?.roles.some((r) => r === 'principal' || r === 'admin')
  const base = `/${school}`
  const [year, setYear] = useState<Row | null | undefined>(undefined)
  const [sections, setSections] = useState<Row[]>([])
  const [sectionId, setSectionId] = useState('')
  const [students, setStudents] = useState<Row[]>([])
  const [teaching, setTeaching] = useState<Row[]>([])
  const [subjects, setSubjects] = useState<Row[]>([])
  const [teachers, setTeachers] = useState<Row[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([api(`${base}/structure/years`), api(`${base}/structure/sections`), api(`${base}/structure/subjects`), api(`${base}/people/teachers`)])
      .then(([y, s, sub, tea]) => { setYear(rowsOf(y).find((r) => r.current) ?? null); setSections(rowsOf(s)); setSubjects(rowsOf(sub)); setTeachers(rowsOf(tea)) })
      .catch((e) => setErr(e.message))
  }, [base])

  const load = useCallback(async () => {
    if (!sectionId) return
    try {
      const [st, te] = await Promise.all([api(`${base}/people/students?sectionId=${sectionId}&limit=200`), api(`${base}/people/teaching`)])
      setStudents(st.rows); setTeaching(rowsOf(te).filter((r) => r.sectionId === sectionId)); setErr('')
    } catch (e) { setErr((e as Error).message) }
  }, [base, sectionId])
  useEffect(() => { load() }, [load])

  const enrol = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      const found = await api(`${base}/people/students?q=${encodeURIComponent(String(f.get('admissionNo')))}&limit=5`)
      const s = found.rows.find((r: Row) => r.admissionNo === f.get('admissionNo'))
      if (!s) return setErr(`No student with admission number ${f.get('admissionNo')}.`)
      await api(`${base}/people/enrollments`, { body: { studentId: s.id, academicYearId: year!.id, sectionId, ...(f.get('rollNo') ? { rollNo: f.get('rollNo') } : {}) } })
      form.reset(); setErr(''); await load()
    } catch (x) { setErr(x instanceof ApiError && x.status === 409 ? 'That student is already in a class this year. Remove them from it first.' : (x as Error).message) }
  }
  const unenrol = async (id: string) => { await api(`${base}/people/enrollments/${id}`, { method: 'DELETE' }); await load() }
  const assign = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    try {
      await api(`${base}/people/teaching`, { body: { academicYearId: year!.id, sectionId, subjectId: f.get('subjectId'), teacherId: f.get('teacherId') } })
      form.reset(); setErr(''); await load()
    } catch (x) { setErr(x instanceof ApiError && x.status === 409 ? 'That subject already has a teacher in this class.' : (x as Error).message) }
  }
  const unassign = async (id: string) => { await api(`${base}/people/teaching/${id}`, { method: 'DELETE' }); await load() }

  if (year === undefined) return <main id="main"><p className="muted">{t('loading')}</p></main>
  if (year === null) return <main id="main"><h1>{t('classes')}</h1><p className="err">Set a current academic year in Setup first.</p></main>
  return (
    <main id="main">
      <h1>{t('classes')}</h1>
      <label style={{ maxWidth: 320 }}>Class ({year.name})
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">{t('select')}</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      {err && <p className="err" role="alert">{err}</p>}
      {sectionId && (
        <>
          <section aria-label="Enrolled students">
            <h2>{t('students')} ({students.length})</h2>
            <div className="card">
              <div className="table-wrap"><table>
                <caption className="sr-only">Students in this class</caption>
                <thead><tr><th scope="col">Admission no</th><th scope="col">{t('name')}</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}><td>{s.admissionNo}</td><td>{s.firstName} {s.lastName}</td>
                      {canWrite && <td><button type="button" className="link" onClick={() => unenrol(s.enrollmentId)}>Remove</button></td>}</tr>
                  ))}
                  {!students.length && <tr><td colSpan={3} className="muted">{t('nothing')}</td></tr>}
                </tbody>
              </table></div>
              {canWrite && (
                <form className="row" onSubmit={enrol}>
                  <label>Admission no<input name="admissionNo" required /></label>
                  <label>Roll no<input name="rollNo" /></label>
                  <button className="primary">{t('add')}</button>
                </form>
              )}
            </div>
          </section>
          <section aria-label="Subject teachers">
            <h2>Subject teachers</h2>
            <div className="card">
              <div className="table-wrap"><table>
                <caption className="sr-only">Who teaches what in this class</caption>
                <thead><tr><th scope="col">Subject</th><th scope="col">Teacher</th></tr></thead>
                <tbody>
                  {teaching.map((r) => (
                    <tr key={r.id}><td>{labelOf(subjects.find((s) => s.id === r.subjectId) ?? {})}</td><td>{labelOf(teachers.find((x) => x.id === r.teacherId) ?? {})}</td>
                      {canWrite && <td><button type="button" className="link" onClick={() => unassign(r.id)}>{t('delete')}</button></td>}</tr>
                  ))}
                  {!teaching.length && <tr><td colSpan={3} className="muted">{t('nothing')}</td></tr>}
                </tbody>
              </table></div>
              {canWrite && (
                <form className="row" onSubmit={assign}>
                  <label>Subject<select name="subjectId" required><option value="">{t('select')}</option>{subjects.map((s) => <option key={s.id} value={s.id}>{labelOf(s)}</option>)}</select></label>
                  <label>Teacher<select name="teacherId" required><option value="">{t('select')}</option>{teachers.map((x) => <option key={x.id} value={x.id}>{labelOf(x)}</option>)}</select></label>
                  <button className="primary">{t('add')}</button>
                </form>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
