import { NavLink } from 'react-router'

const navItems = [
  { to: '/today', label: 'Today', icon: '◉' },
  { to: '/inbox', label: 'Inbox', icon: '↓' },
  { to: '/backlog', label: 'Backlog', icon: '☷' },
  { to: '/notes', label: 'Notes', icon: '¶' },
  { to: '/habits', label: 'Habits', icon: '↺' },
] as const

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/80 backdrop-blur-xl z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors duration-200 ${
                isActive
                  ? 'text-primary'
                  : 'text-on-surface-variant'
              }`
            }
          >
            <span className="text-lg">{icon}</span>
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
