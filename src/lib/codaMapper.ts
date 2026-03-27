import type { TodoStatus, TodoSize, EnergyLevel } from '@/types'
import type { AddTodoInput } from '@/context/TodosContext'

/**
 * Coda column → Tempo field mapping from PRD Section 12.
 * Keys are lowercase Coda header names, values are Tempo field names.
 */
const HEADER_MAP: Record<string, string> = {
  task: 'title',
  title: 'title',
  name: 'title',
  project: 'project',
  status: 'status',
  progress: 'progress',
  size: 'size',
  impact: 'impact',
  'impact (stars)': 'impact',
  'energy level': 'energy_level',
  energy: 'energy_level',
  'due date': 'due_date',
  due: 'due_date',
  supports: 'supports',
}

/** Auto-map a CSV header to a Tempo field (case-insensitive, fuzzy). */
export function autoMapHeader(header: string): string | null {
  const normalized = header.toLowerCase().trim()
  return HEADER_MAP[normalized] ?? null
}

/** Parse Coda status string → Tempo TodoStatus. */
function mapStatus(raw: string): TodoStatus {
  const s = raw.toLowerCase().trim()
  if (s.includes('done') || s.includes('complete')) return 'done'
  // Both "Not started" and "In progress" become backlog per PRD
  return 'backlog'
}

/** Parse size string → TodoSize. */
function mapSize(raw: string): TodoSize | undefined {
  const s = raw.toLowerCase().trim()
  if (s === 'small' || s === 's') return 'small'
  if (s === 'medium' || s === 'm') return 'medium'
  if (s === 'large' || s === 'l') return 'large'
  return undefined
}

/** Parse energy level string → EnergyLevel. */
function mapEnergy(raw: string): EnergyLevel | undefined {
  const s = raw.toLowerCase().trim().replace(/[-\s]+/g, '_')
  if (['low', 'medium_low', 'medium', 'high'].includes(s)) return s as EnergyLevel
  // Handle "med-low", "med low" etc.
  if (s.includes('med') && s.includes('low')) return 'medium_low'
  if (s === 'med' || s === 'moderate') return 'medium'
  return undefined
}

/** Parse impact (1–5 integer or star count). */
function mapImpact(raw: string): number | undefined {
  const n = parseInt(raw, 10)
  if (!isNaN(n) && n >= 1 && n <= 5) return n
  // Count star characters
  const stars = (raw.match(/★|⭐/g) ?? []).length
  if (stars >= 1 && stars <= 5) return stars
  return undefined
}

/** Parse date string → Date. */
function mapDate(raw: string): Date | undefined {
  if (!raw.trim()) return undefined
  const d = new Date(raw)
  return isNaN(d.getTime()) ? undefined : d
}

export interface CodaMappedTodo extends AddTodoInput {
  _status: TodoStatus
  _progress?: number
  _supports?: string
}

/**
 * Map a single CSV row (keyed by Coda headers) to a Tempo todo,
 * using the provided column mapping.
 */
export function mapRow(
  row: Record<string, string>,
  columnMap: Record<string, string>, // csvHeader → tempoField
): CodaMappedTodo | null {
  // Build a tempoField → value lookup
  const mapped: Record<string, string> = {}
  for (const [csvHeader, tempoField] of Object.entries(columnMap)) {
    if (tempoField && row[csvHeader] !== undefined) {
      mapped[tempoField] = row[csvHeader]
    }
  }

  const title = mapped['title']?.trim()
  if (!title) return null // Skip rows without a title

  const status = mapped['status'] ? mapStatus(mapped['status']) : 'backlog'

  return {
    title,
    status,
    project: mapped['project']?.trim() || undefined,
    size: mapped['size'] ? mapSize(mapped['size']) : undefined,
    impact: mapped['impact'] ? mapImpact(mapped['impact']) : undefined,
    energy_level: mapped['energy_level'] ? mapEnergy(mapped['energy_level']) : undefined,
    due_date: mapped['due_date'] ? mapDate(mapped['due_date']) : undefined,
    _status: status,
    _progress: mapped['progress'] ? parseInt(mapped['progress'], 10) || undefined : undefined,
    _supports: mapped['supports']?.trim() || undefined,
  }
}

/** Summarize import preview stats. */
export function summarizeImport(items: CodaMappedTodo[]) {
  return {
    total: items.length,
    backlog: items.filter((i) => i._status === 'backlog').length,
    done: items.filter((i) => i._status === 'done').length,
    withProject: items.filter((i) => i.project).length,
    withDueDate: items.filter((i) => i.due_date).length,
    withEnergy: items.filter((i) => i.energy_level).length,
  }
}
