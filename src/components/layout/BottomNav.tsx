import { NavLink } from 'react-router'

const navItems = [
  { to: '/today', label: 'Today', icon: '◉' },
  { to: '/inbox', label: 'Inbox', icon: '↓' },
  { to: '/backlog', label: 'Backlog', icon: '☷' },
  { to: '/habits', label: 'Habits', icon: '↺' },
] as const

interface BottomNavProps {
  onMenuOpen: () => void
}

export function BottomNav({ onMenuOpen }: BottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/80 backdrop-blur-xl z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors duration-200 ${
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
        <button
          onClick={onMenuOpen}
          className="flex flex-col items-center gap-1 px-3 py-2 text-xs text-on-surface-variant transition-colors duration-200 cursor-pointer"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
          <span className="font-medium">More</span>
        </button>
      </div>
    </nav>
  )
}
