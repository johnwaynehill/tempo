interface FilterOption<T extends string> {
  value: T
  label: string
}

interface FilterDropdownProps<T extends string> {
  /** Button label when no active selection */
  label: string
  options: FilterOption<T>[]
  /** Current selected value (undefined = nothing selected) */
  value: T | undefined
  /** Label for the clear/reset option (shown when a value is selected) */
  clearLabel?: string
  /** Whether the dropdown menu is open */
  open: boolean
  onToggle: () => void
  onClose: () => void
  onChange: (value: T | undefined) => void
}

export function FilterDropdown<T extends string>({
  label,
  options,
  value,
  clearLabel,
  open,
  onToggle,
  onClose,
  onChange,
}: FilterDropdownProps<T>) {
  const isActive = value !== undefined
  const activeOption = isActive ? options.find((o) => o.value === value) : undefined

  const select = (optionValue: T | undefined) => {
    onChange(optionValue)
    onClose()
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'bg-surface-container-high text-on-surface-variant'
        }`}
      >
        {activeOption ? activeOption.label : label}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="currentColor"
        >
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 py-1.5 min-w-[140px]">
            {isActive && clearLabel && (
              <button
                onClick={() => select(undefined)}
                className="w-full text-left px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                {clearLabel}
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => select(option.value)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  value === option.value
                    ? 'text-primary font-medium bg-primary/5'
                    : 'text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
