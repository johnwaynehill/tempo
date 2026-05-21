interface DateFieldProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  /** ARIA label for the field (defaults to placeholder text) */
  ariaLabel?: string
}

/**
 * A date picker that looks like our other form inputs and respects our theme,
 * sizing, and dark mode — backed by the native date picker for selection.
 *
 * Approach: render a styled `<div>` that shows the value or placeholder, then
 * layer an invisible `<input type="date">` on top of it via absolute
 * positioning + `opacity: 0`. Taps go to the input, which natively opens its
 * date picker. The native widget is never visible, so its intrinsic sizing,
 * placeholder rendering, and theme-color issues don't matter.
 *
 * Why not `showPicker()`?
 *
 * `showPicker()` is the official API but iOS Safari has been inconsistent
 * about when it works (focus state, user-gesture detection, sr-only inputs
 * vs. visible-but-transparent inputs all matter and differ across versions).
 * Layering the input transparently uses pure native click handling, which
 * has been reliable on iOS Safari since forever.
 */
export function DateField({ value, onChange, placeholder = 'Pick a date', ariaLabel }: DateFieldProps) {
  // YYYY-MM-DD for the native input
  const valueStr = value
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : ''
  // Human-readable for the visible label, e.g. "May 21, 2026"
  const displayValue = value
    ? value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  return (
    <div className="relative w-full">
      {/* Visible UI. `pointer-events-none` so taps fall through to the input
          layered on top. The styled div has no intrinsic min-width problems
          because it's just a div, not a native form control. */}
      <div
        className={`w-full bg-surface-container rounded-lg px-3 py-2.5 text-sm min-h-[44px] flex items-center justify-between gap-2 pointer-events-none ${
          value ? 'pr-10' : ''
        }`}
      >
        <span className={displayValue ? 'text-on-surface' : 'text-on-surface-variant/50'}>
          {displayValue ?? placeholder}
        </span>
        {!value && (
          <svg
            className="w-4 h-4 text-on-surface-variant shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )}
      </div>

      {/* Invisible native input layered on top. Taps go here directly so
          iOS opens its native picker. For desktop Firefox (which doesn't
          auto-open on click — it expects the user to type or click a tiny
          calendar icon that's invisible at opacity:0), we also call
          `showPicker()` explicitly from the click handler. Both paths are
          driven by the same user gesture so they don't conflict. */}
      <input
        type="date"
        value={valueStr}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
        onClick={(e) => {
          const input = e.currentTarget
          if (typeof input.showPicker === 'function') {
            try {
              input.showPicker()
            } catch {
              // ignore — fall back to whatever the browser does natively
            }
          }
        }}
        aria-label={ariaLabel ?? placeholder}
        className="absolute inset-0 w-full h-full min-w-0 opacity-0 cursor-pointer"
      />

      {/* Clear button. `z-10` lifts it above the input so the × tap clears
          instead of opening the picker. */}
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onChange(null)
          }}
          aria-label="Clear date"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </div>
  )
}
