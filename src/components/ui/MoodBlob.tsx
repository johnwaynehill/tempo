/**
 * Illustrative mood blob characters — soft, rounded creatures with
 * expressive faces. Inspired by Tiimo, How We Feel, and Daylio.
 *
 * Each mood has a unique color, shape, and personality.
 */

interface MoodBlobProps {
  mood: 'awful' | 'bad' | 'meh' | 'good' | 'great'
  size?: number
  selected?: boolean
  className?: string
}

/** Color palette — warm pastels keyed to mood */
export const BLOB_COLORS: Record<MoodBlobProps['mood'], { bg: string; face: string; glow: string }> = {
  awful:  { bg: '#E8B4B8', face: '#6B3A3E', glow: '#E8B4B840' },  // dusty rose
  bad:    { bg: '#C9B8D9', face: '#4A3660', glow: '#C9B8D940' },  // soft lavender
  meh:    { bg: '#D5D0C8', face: '#5A5650', glow: '#D5D0C840' },  // warm gray
  good:   { bg: '#B8DBC2', face: '#2D5E3A', glow: '#B8DBC240' },  // mint green
  great:  { bg: '#F5D990', face: '#6B5520', glow: '#F5D99040' },  // warm gold
}

export function MoodBlob({ mood, size = 80, selected = false, className = '' }: MoodBlobProps) {
  const colors = BLOB_COLORS[mood]
  const s = size

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ filter: selected ? `drop-shadow(0 0 12px ${colors.glow})` : undefined }}
    >
      {/* Blob body — organic rounded shape, slightly different per mood */}
      {mood === 'awful' && (
        <>
          {/* Droopy, slightly melted blob */}
          <path
            d="M50 8 C72 8, 90 22, 90 45 C90 62, 85 78, 72 88 C60 95, 40 95, 28 88 C15 78, 10 62, 10 45 C10 22, 28 8, 50 8Z"
            fill={colors.bg}
          />
          {/* Eyes — droopy, worried */}
          <ellipse cx="36" cy="46" rx="4.5" ry="5.5" fill={colors.face} />
          <ellipse cx="64" cy="46" rx="4.5" ry="5.5" fill={colors.face} />
          {/* Eyebrows — worried, angled up in center */}
          <path d="M27 36 Q33 32, 40 35" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M73 36 Q67 32, 60 35" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Mouth — wobbly frown */}
          <path d="M35 66 Q42 60, 50 62 Q58 64, 65 58" stroke={colors.face} strokeWidth="2.8" strokeLinecap="round" fill="none" />
          {/* Tear drop */}
          <ellipse cx="72" cy="55" rx="2.5" ry="3.5" fill={colors.face} opacity="0.25" />
        </>
      )}

      {mood === 'bad' && (
        <>
          {/* Slightly deflated blob */}
          <path
            d="M50 10 C74 10, 88 26, 88 48 C88 68, 76 90, 50 90 C24 90, 12 68, 12 48 C12 26, 26 10, 50 10Z"
            fill={colors.bg}
          />
          {/* Eyes — half-closed, tired */}
          <path d="M30 46 Q36 42, 42 46" stroke={colors.face} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M58 46 Q64 42, 70 46" stroke={colors.face} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* Small dots under eye arcs */}
          <circle cx="36" cy="48" r="1.5" fill={colors.face} opacity="0.3" />
          <circle cx="64" cy="48" r="1.5" fill={colors.face} opacity="0.3" />
          {/* Mouth — slight downturn */}
          <path d="M38 65 Q50 60, 62 65" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      )}

      {mood === 'meh' && (
        <>
          {/* Perfectly round, neutral blob */}
          <circle cx="50" cy="50" r="40" fill={colors.bg} />
          {/* Eyes — dot eyes, neutral */}
          <circle cx="37" cy="44" r="4" fill={colors.face} />
          <circle cx="63" cy="44" r="4" fill={colors.face} />
          {/* Eye shine */}
          <circle cx="39" cy="42.5" r="1.5" fill="white" opacity="0.6" />
          <circle cx="65" cy="42.5" r="1.5" fill="white" opacity="0.6" />
          {/* Mouth — flat line */}
          <path d="M38 62 L62 62" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {mood === 'good' && (
        <>
          {/* Slightly bouncy, happy blob */}
          <path
            d="M50 8 C76 8, 92 26, 90 48 C88 72, 74 92, 50 92 C26 92, 12 72, 10 48 C8 26, 24 8, 50 8Z"
            fill={colors.bg}
          />
          {/* Eyes — happy, slightly squinted */}
          <ellipse cx="36" cy="44" rx="4.5" ry="4" fill={colors.face} />
          <ellipse cx="64" cy="44" rx="4.5" ry="4" fill={colors.face} />
          {/* Eye shine */}
          <circle cx="38" cy="42.5" r="1.8" fill="white" opacity="0.5" />
          <circle cx="66" cy="42.5" r="1.8" fill="white" opacity="0.5" />
          {/* Mouth — open smile */}
          <path d="M34 60 Q50 74, 66 60" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Cheek blush */}
          <circle cx="26" cy="56" r="5" fill={colors.face} opacity="0.08" />
          <circle cx="74" cy="56" r="5" fill={colors.face} opacity="0.08" />
        </>
      )}

      {mood === 'great' && (
        <>
          {/* Big, bouncy, joyful blob — slightly wider */}
          <path
            d="M50 6 C78 6, 94 24, 92 50 C90 76, 74 94, 50 94 C26 94, 10 76, 8 50 C6 24, 22 6, 50 6Z"
            fill={colors.bg}
          />
          {/* Eyes — happy arcs (closed from smiling) */}
          <path d="M28 42 Q36 34, 44 42" stroke={colors.face} strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M56 42 Q64 34, 72 42" stroke={colors.face} strokeWidth="3" strokeLinecap="round" fill="none" />
          {/* Mouth — big open smile with fill */}
          <path d="M30 58 Q50 80, 70 58" stroke={colors.face} strokeWidth="2.5" strokeLinecap="round" fill={colors.face} fillOpacity="0.12" />
          {/* Cheek blush */}
          <circle cx="24" cy="54" r="6" fill={colors.face} opacity="0.1" />
          <circle cx="76" cy="54" r="6" fill={colors.face} opacity="0.1" />
          {/* Sparkle accents */}
          <path d="M82 18 L84 14 L86 18 L90 20 L86 22 L84 26 L82 22 L78 20Z" fill={colors.face} opacity="0.2" />
          <path d="M14 26 L15.5 23 L17 26 L20 27.5 L17 29 L15.5 32 L14 29 L11 27.5Z" fill={colors.face} opacity="0.15" />
        </>
      )}
    </svg>
  )
}

/** Maps numeric mood value (1-100) to discrete mood key */
export function moodFromValue(value: number): MoodBlobProps['mood'] {
  if (value <= 15) return 'awful'
  if (value <= 35) return 'bad'
  if (value <= 65) return 'meh'
  if (value <= 85) return 'good'
  return 'great'
}

/** Maps discrete mood to its numeric center value */
export const MOOD_VALUES: Record<MoodBlobProps['mood'], number> = {
  awful: 8,
  bad: 25,
  meh: 50,
  good: 75,
  great: 92,
}

/** Labels for display */
export const MOOD_LABELS: Record<MoodBlobProps['mood'], string> = {
  awful: 'Awful',
  bad: 'Bad',
  meh: 'Meh',
  good: 'Good',
  great: 'Great',
}

export type MoodKey = MoodBlobProps['mood']
