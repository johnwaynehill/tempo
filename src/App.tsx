import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/Login'
import { TodayPage } from '@/pages/Today'
import { InboxPage } from '@/pages/Inbox'
import { BacklogPage } from '@/pages/Backlog'
import { NotesPage } from '@/pages/Notes'
import { NoteEditorPage } from '@/pages/NoteEditor'
import { BrainDumpPage } from '@/pages/BrainDump'
import { SettingsPage } from '@/pages/Settings'

function AuthenticatedApp() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={<NoteEditorPage />} />
        <Route path="/braindump" element={<BrainDumpPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  useTheme()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      {user ? <AuthenticatedApp /> : <LoginPage />}
    </BrowserRouter>
  )
}
