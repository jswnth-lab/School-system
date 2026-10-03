import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './index.css'
import { Platform } from './Platform'
import { SchoolLayout, Login, Dashboard } from './School'
import { Setup } from './Setup'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/platform" element={<Platform />} />
        <Route path="/:school" element={<SchoolLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="login" element={<Login />} />
          <Route path="setup" element={<Setup />} />
        </Route>
        <Route path="*" element={<Navigate to="/platform" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
