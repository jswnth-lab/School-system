import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './index.css'
import { Platform } from './Platform'
import { SchoolLayout, Login, Dashboard } from './School'
import { Setup } from './Setup'
import { People } from './People'
import { Import } from './Import'
import { Classes } from './Classes'
import { Users } from './Users'
import { Audit } from './Audit'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/platform" element={<Platform />} />
        <Route path="/:school" element={<SchoolLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="login" element={<Login />} />
          <Route path="setup" element={<Setup />} />
          <Route path="people" element={<People />} />
          <Route path="import" element={<Import />} />
          <Route path="classes" element={<Classes />} />
          <Route path="users" element={<Users />} />
          <Route path="audit" element={<Audit />} />
        </Route>
        <Route path="*" element={<Navigate to="/platform" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
