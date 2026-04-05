import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/hooks/useTheme'
import { AppShell } from '@/components/layout/AppShell'
import { OfflineBanner } from '@/components/ui/OfflineBanner'
import { UpdatePrompt } from '@/components/ui/UpdatePrompt'
import { LoginPage } from '@/pages/Login'
import { TodayPage } from '@/pages/Today'
import { InboxPage } from '@/pages/Inbox'
import { BacklogPage } from '@/pages/Backlog'
import { NotesPage } from '@/pages/Notes'
import { NoteEditorPage } from '@/pages/NoteEditor'
import { BrainDumpPage } from '@/pages/BrainDump'
import { SettingsPage } from '@/pages/Settings'
import { ProjectDetailPage } from '@/pages/ProjectDetail'
import { InsightsPage } from '@/pages/Insights'
import { WeeklyReviewPage } from '@/pages/WeeklyReview'
import { HabitsPage } from '@/pages/Habits'
import { HabitDetailPage } from '@/pages/HabitDetail'
import { AIChatPage } from '@/pages/AIChat'
import { CompletedPage } from '@/pages/Completed'
import { ProjectsPage } from '@/pages/Projects'

function AuthenticatedApp() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/today" element={<TodayPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={<NoteEditorPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectSlug" element={<ProjectDetailPage />} />
        <Route path="/braindump" element={<BrainDumpPage />} />
        <Route path="/habits" element={<HabitsPage />} />
        <Route path="/habits/:habitId" element={<HabitDetailPage />} />
        <Route path="/calendar" element={<Navigate to="/backlog" replace />} />
        <Route path="/completed" element={<CompletedPage />} />
        <Route path="/chat" element={<AIChatPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/review" element={<WeeklyReviewPage />} />
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
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3">
        <img src="/favicon.svg" alt="Tempo" className="w-12 h-12" />
        <p className="text-on-surface-variant text-xs tracking-wide">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <OfflineBanner />
      <UpdatePrompt />
      <BrowserRouter>
        {user ? <AuthenticatedApp /> : <LoginPage />}
      </BrowserRouter>
    </>
  )
}
