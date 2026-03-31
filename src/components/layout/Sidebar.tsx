import { NavLink } from 'react-router'
import { useAuth } from '@/context/AuthContext'

const mainNav = [
  { to: '/today', label: 'Today', icon: '◉' },
  { to: '/inbox', label: 'Inbox', icon: '↓' },
  { to: '/backlog', label: 'Backlog', icon: '☷' },
] as const

const captureNav = [
  { to: '/notes', label: 'Notes', icon: '¶' },
  { to: '/braindump', label: 'Brain Dump', icon: '⚡' },
] as const

const trackNav = [
  { to: '/habits', label: 'Habits', icon: '↺' },
  { to: '/calendar', label: 'Calendar', icon: '▦' },
] as const

const reflectNav = [
  { to: '/insights', label: 'Insights', icon: '◎' },
  { to: '/review', label: 'Review', icon: '↻' },
] as const

function NavGroup({ items }: { items: ReadonlyArray<{ to: string; label: string; icon: string }> }) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
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
    </div>
  )
}

export function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-52 bg-surface-container-low h-screen sticky top-0 px-4 py-6 justify-between">
      {/* Top: brand + nav */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8 px-3">
          <img src="/favicon.svg" alt="" className="w-6 h-6" />
          <h1 className="font-display text-lg font-bold text-primary tracking-tight">
            Tempo
          </h1>
        </div>

        {/* Navigation groups */}
        <nav className="flex flex-col gap-5 overflow-y-auto flex-1 min-h-0">
          <NavGroup items={mainNav} />
          <NavGroup items={captureNav} />
          <NavGroup items={trackNav} />
          <NavGroup items={reflectNav} />
        </nav>
      </div>

      {/* Bottom: Settings + User */}
      <div className="flex flex-col gap-2 flex-shrink-0 pt-4">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
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
            className="flex items-center gap-3 px-3 py-2 text-xs text-on-surface-variant hover:text-on-surface transition-colors duration-200 cursor-pointer rounded-xl"
          >
            <img
              src={user.photoURL ?? ''}
              alt=""
              className="w-5 h-5 rounded-full"
            />
            <span className="truncate">{user.displayName}</span>
          </button>
        )}
      </div>
    </aside>
  )
}
