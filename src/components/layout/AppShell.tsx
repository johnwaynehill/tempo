import { useState, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileMenu } from '@/components/ui/MobileMenu'
import { ShortcutsSheet } from '@/components/ui/ShortcutsSheet'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'
import { useKeyboardShortcuts, type Shortcut } from '@/hooks/useKeyboardShortcuts'
import { useNotes } from '@/hooks/useNotes'
import { useTodos } from '@/hooks/useTodos'
import { useNewTodo } from '@/hooks/useNewTodo'
import { useReminderScheduler } from '@/hooks/useReminderScheduler'

export function AppShell() {
  // Background: check for due reminders and fire notifications
  useReminderScheduler()
  const navigate = useNavigate()
  const { addNote } = useNotes()
  const { completeTodo, deferTodo } = useTodos()
  const { newTodo, createTodo, closeNewTodo } = useNewTodo('inbox')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const shortcuts: Shortcut[] = useMemo(
    () => [
      // Navigation
      { label: '1', description: 'Go to Today',      key: '1', action: () => navigate('/today') },
      { label: '2', description: 'Go to Inbox',       key: '2', action: () => navigate('/inbox') },
      { label: '3', description: 'Go to Backlog',     key: '3', action: () => navigate('/backlog') },
      { label: '4', description: 'Go to Notes',       key: '4', action: () => navigate('/notes') },
      { label: '5', description: 'Go to Brain Dump',  key: '5', action: () => navigate('/braindump') },
      { label: '6', description: 'Go to Habits',      key: '6', action: () => navigate('/habits') },
      { label: '7', description: 'Go to Insights',    key: '7', action: () => navigate('/insights') },
      { label: '8', description: 'Go to Review',      key: '8', action: () => navigate('/review') },
      { label: ',', description: 'Go to Settings',    key: ',', action: () => navigate('/settings') },
      // Actions
      { label: 'C', description: 'New todo',            key: 'c', action: () => createTodo() },
      {
        label: 'N',
        description: 'New note',
        key: 'n',
        action: async () => {
          const id = await addNote('Untitled')
          navigate(`/notes/${id}`)
        },
      },
      // Focus & Plan
      { label: 'F', description: 'Focus mode', key: 'f', action: () => navigate('/focus') },
      { label: 'P', description: 'Plan my day', key: 'p', action: () => navigate('/plan') },
      // Help
      { label: '?', description: 'Keyboard shortcuts', key: '?', shift: true, action: () => setShortcutsOpen((v) => !v) },
    ],
    [navigate, addNote, createTodo],
  )

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="flex min-h-dvh bg-surface">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="max-w-2xl mx-auto px-5 md:px-10 pt-[max(2rem,env(safe-area-inset-top))] pb-8 md:py-12">
          <Outlet context={{ onMenuOpen: () => setMenuOpen(true) }} />
        </div>
      </main>

      <BottomNav />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {newTodo && (
        <TodoDetailDrawer
          todo={newTodo}
          onClose={closeNewTodo}
          onComplete={completeTodo}
          onDefer={deferTodo}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsSheet onClose={() => setShortcutsOpen(false)} />
      )}
    </div>
  )
}
