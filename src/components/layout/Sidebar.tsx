import { useState, useEffect } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '@/context/AuthContext'
import { useProjects } from '@/hooks/useProjects'

const navItems = [
  { to: '/today', label: 'Today', icon: '◉' },
  { to: '/inbox', label: 'Inbox', icon: '↓' },
  { to: '/backlog', label: 'Backlog', icon: '☰' },
  { to: '/notes', label: 'Notes', icon: '¶' },
  { to: '/braindump', label: 'Brain Dump', icon: '⚡' },
  { to: '/habits', label: 'Habits', icon: '↺' },
] as const

const PROJECTS_COLLAPSED_KEY = 'tempo-sidebar-projects-collapsed'
const REFLECT_COLLAPSED_KEY = 'tempo-sidebar-reflect-collapsed'

const reflectItems = [
  { to: '/insights', label: 'Insights', icon: '◎' },
  { to: '/review', label: 'Review', icon: '↻' },
] as const

export function Sidebar() {
  const { user, signOut } = useAuth()
  const { projects, projectCounts } = useProjects()

  const [projectsCollapsed, setProjectsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(PROJECTS_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [reflectCollapsed, setReflectCollapsed] = useState(() => {
    try {
      return localStorage.getItem(REFLECT_COLLAPSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_COLLAPSED_KEY, String(projectsCollapsed))
    } catch { /* ignore */ }
  }, [projectsCollapsed])

  useEffect(() => {
    try {
      localStorage.setItem(REFLECT_COLLAPSED_KEY, String(reflectCollapsed))
    } catch { /* ignore */ }
  }, [reflectCollapsed])

  return (
    <aside className="hidden md:flex flex-col w-56 bg-surface-container-low h-screen sticky top-0 p-6 justify-between">
      {/* Top section: brand + nav + projects (scrollable) */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-10 flex-shrink-0">
          <img src="/favicon.svg" alt="" className="w-7 h-7" />
          <h1 className="font-display text-xl font-bold text-primary tracking-tight">
            Tempo
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-shrink-0">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-surface-container-lowest text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Projects section */}
        {projects.length > 0 && (
          <div className="mt-6 min-h-0 flex flex-col">
            <button
              onClick={() => setProjectsCollapsed(!projectsCollapsed)}
              className="flex items-center gap-2 px-3 py-1.5 mb-1 cursor-pointer group flex-shrink-0"
            >
              <svg
                className={`w-3 h-3 text-on-surface-variant transition-transform duration-200 ${
                  projectsCollapsed ? '' : 'rotate-90'
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M4 2l5 4-5 4V2z" />
              </svg>
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Projects
              </span>
            </button>

            {!projectsCollapsed && (
              <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
                {projects.map((name) => (
                  <NavLink
                    key={name}
                    to={`/projects/${encodeURIComponent(name)}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors duration-200 ${
                        isActive
                          ? 'bg-surface-container-lowest text-primary font-medium'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                      }`
                    }
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 4.5A1.5 1.5 0 013.5 3h2.379a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
                    </svg>
                    <span className="truncate flex-1">{name}</span>
                    {(projectCounts[name] ?? 0) > 0 && (
                      <span className="text-xs text-on-surface-variant/60 flex-shrink-0">
                        {projectCounts[name]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reflect section */}
        <div className="mt-6 flex-shrink-0">
          <button
            onClick={() => setReflectCollapsed(!reflectCollapsed)}
            className="flex items-center gap-2 px-3 py-1.5 mb-1 cursor-pointer group"
          >
            <svg
              className={`w-3 h-3 text-on-surface-variant transition-transform duration-200 ${
                reflectCollapsed ? '' : 'rotate-90'
              }`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M4 2l5 4-5 4V2z" />
            </svg>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Reflect
            </span>
          </button>

          {!reflectCollapsed && (
            <div className="flex flex-col gap-0.5">
              {reflectItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors duration-200 ${
                      isActive
                        ? 'bg-surface-container-lowest text-primary font-medium'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`
                  }
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User + Settings (always at bottom) */}
      <div className="flex flex-col gap-3 flex-shrink-0 pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
              isActive
                ? 'bg-surface-container-lowest text-primary'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`
          }
        >
          <span className="text-base w-5 text-center">⚙</span>
          Settings
        </NavLink>

        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer"
          >
            <img
              src={user.photoURL ?? ''}
              alt=""
              className="w-6 h-6 rounded-full"
            />
            <span className="truncate">{user.displayName}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
