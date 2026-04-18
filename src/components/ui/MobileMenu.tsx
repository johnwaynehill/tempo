import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/context/AuthContext'
import { useNotes } from '@/hooks/useNotes'
import { useTodos } from '@/hooks/useTodos'
import { useNewTodo } from '@/hooks/useNewTodo'
import { TodoDetailDrawer } from '@/components/ui/TodoDetailDrawer'

const navItems = [
  {
    to: '/chat?mode=today',
    label: 'Tempo AI',
    icon: '<svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M7 2C7 5.5 9 7.5 13 8C9 8.5 7 10.5 7 14C7 10.5 5 8.5 1 8C5 7.5 7 5.5 7 2Z"/><path d="M13 0C13 1.2 13.8 2 15 2C13.8 2 13 2.8 13 4C13 2.8 12.2 2 11 2C12.2 2 13 1.2 13 0Z" opacity="0.55"/></svg>',
    divider: true,
  },
  {
    to: '/habits',
    label: 'Habits',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
  },
  {
    to: '/braindump',
    label: 'Brain Dump',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    divider: true,
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',
    divider: true,
  },
  {
    to: '/completed',
    label: 'Completed',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  },
  {
    to: '/insights',
    label: 'Insights',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  },
  {
    to: '/review',
    label: 'Weekly Review',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>',
    divider: true,
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  },
]

export function MobileMenu() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { addNote } = useNotes()
  const { completeTodo, deferTodo } = useTodos()
  const { newTodo, createTodo, closeNewTodo } = useNewTodo('inbox')
  const [open, setOpen] = useState(false)

  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
        aria-label="Menu"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[200px]">
            {/* Create actions */}
            <button
              onClick={() => { setOpen(false); createTodo() }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="text-on-surface-variant">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              New Todo
            </button>
            <button
              onClick={async () => {
                setOpen(false)
                const id = await addNote('Untitled')
                navigate(`/notes/${id}`)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="text-on-surface-variant">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              New Note
            </button>

            <div className="border-t border-outline-variant/15 my-1.5" />

            {/* Navigation */}
            {navItems.map(({ to, label, icon, divider }) => (
              <div key={to}>
                <button
                  onClick={() => { navigate(to); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="text-on-surface-variant" dangerouslySetInnerHTML={{ __html: icon }} />
                  {label}
                </button>
                {divider && <div className="border-t border-outline-variant/15 my-1.5" />}
              </div>
            ))}

            {user && (
              <>
                <div className="border-t border-outline-variant/15 my-1.5" />
                <div className="flex items-center gap-3 px-4 py-2.5">
                  {user.photoURL && (
                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface text-xs font-medium truncate">{user.displayName}</p>
                    <p className="text-on-surface-variant text-[11px] truncate">{user.email}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {newTodo && (
        <TodoDetailDrawer
          todo={newTodo}
          onClose={closeNewTodo}
          onComplete={completeTodo}
          onDefer={deferTodo}
        />
      )}
    </div>
  )
}
