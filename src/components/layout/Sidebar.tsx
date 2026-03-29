import { NavLink } from 'react-router'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/today', label: 'Today', icon: '◉' },
  { to: '/inbox', label: 'Inbox', icon: '↓' },
  { to: '/backlog', label: 'Backlog', icon: '☰' },
  { to: '/notes', label: 'Notes', icon: '¶' },
  { to: '/braindump', label: 'Brain Dump', icon: '⚡' },
] as const

export function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-56 bg-surface-container-low h-screen sticky top-0 p-6 justify-between">
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2.5 mb-10">
          <img src="/favicon.svg" alt="" className="w-7 h-7" />
          <h1 className="font-display text-xl font-bold text-primary tracking-tight">
            Tempo
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
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
      </div>

      {/* User + Settings */}
      <div className="flex flex-col gap-3">
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
