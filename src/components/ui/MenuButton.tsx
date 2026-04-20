import { useMenuOpen } from '@/hooks/useMenuOpen'

export function MenuButton() {
  const onMenuOpen = useMenuOpen()

  return (
    <button
      onClick={onMenuOpen}
      className="p-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer md:hidden"
      aria-label="Menu"
      title="Menu"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
      </svg>
    </button>
  )
}
