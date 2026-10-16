/** Mood scale shared by the mood blob, slider, Today and the Mood page. */

export type MoodKey = 'awful' | 'bad' | 'meh' | 'good' | 'great'

/** Color palette — warm pastels keyed to mood */
export const BLOB_COLORS: Record<MoodKey, { bg: string; face: string; glow: string }> = {
  awful:  { bg: '#E8B4B8', face: '#6B3A3E', glow: '#E8B4B840' },  // dusty rose
  bad:    { bg: '#C9B8D9', face: '#4A3660', glow: '#C9B8D940' },  // soft lavender
  meh:    { bg: '#D5D0C8', face: '#5A5650', glow: '#D5D0C840' },  // warm gray
  good:   { bg: '#B8DBC2', face: '#2D5E3A', glow: '#B8DBC240' },  // mint green
  great:  { bg: '#F5D990', face: '#6B5520', glow: '#F5D99040' },  // warm gold
}

/** Maps numeric mood value (1-100) to discrete mood key */
export function moodFromValue(value: number): MoodKey {
  if (value <= 15) return 'awful'
  if (value <= 35) return 'bad'
  if (value <= 65) return 'meh'
  if (value <= 85) return 'good'
  return 'great'
}

/** Maps discrete mood to its numeric center value */
export const MOOD_VALUES: Record<MoodKey, number> = {
  awful: 8,
  bad: 25,
  meh: 50,
  good: 75,
  great: 92,
}

/** Labels for display */
export const MOOD_LABELS: Record<MoodKey, string> = {
  awful: 'Awful',
  bad: 'Bad',
  meh: 'Meh',
  good: 'Good',
  great: 'Great',
}
