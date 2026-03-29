import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type FirestoreDataConverter,
  Timestamp,
} from 'firebase/firestore'
import type { Todo, Note, UserPreferences, TodaySet } from '@/types'

// --- Helpers ---

function toDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  return undefined
}

function toTimestampOrNull(value: Date | undefined): Timestamp | null {
  return value ? Timestamp.fromDate(value) : null
}

// --- Todo Converter ---

export const todoConverter: FirestoreDataConverter<Todo> = {
  toFirestore(todo: Todo): DocumentData {
    return {
      title: todo.title,
      status: todo.status,
      progress: todo.progress ?? null,
      project: todo.project ?? null,
      size: todo.size ?? null,
      impact: todo.impact ?? null,
      energy_level: todo.energy_level ?? null,
      due_date: toTimestampOrNull(todo.due_date),
      supports: todo.supports ?? null,
      note_id: todo.note_id ?? null,
      defer_until: toTimestampOrNull(todo.defer_until),
      reminder_at: toTimestampOrNull(todo.reminder_at),
      dismissed_from_today: toTimestampOrNull(todo.dismissed_from_today),
      created_at: Timestamp.fromDate(todo.created_at),
      updated_at: Timestamp.fromDate(todo.updated_at),
      completed_at: toTimestampOrNull(todo.completed_at),
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): Todo {
    const d = snapshot.data(options)
    return {
      id: snapshot.id,
      title: d.title,
      status: d.status,
      progress: d.progress ?? undefined,
      project: d.project ?? undefined,
      size: d.size ?? undefined,
      impact: d.impact ?? undefined,
      energy_level: d.energy_level ?? undefined,
      due_date: toDate(d.due_date),
      supports: d.supports ?? undefined,
      note_id: d.note_id ?? undefined,
      defer_until: toDate(d.defer_until),
      reminder_at: toDate(d.reminder_at),
      dismissed_from_today: toDate(d.dismissed_from_today),
      created_at: toDate(d.created_at) ?? new Date(),
      updated_at: toDate(d.updated_at) ?? new Date(),
      completed_at: toDate(d.completed_at),
    }
  },
}

// --- Note Converter ---

export const noteConverter: FirestoreDataConverter<Note> = {
  toFirestore(note: Note): DocumentData {
    return {
      title: note.title,
      content: note.content,
      linked_todo_id: note.linked_todo_id ?? null,
      created_at: Timestamp.fromDate(note.created_at),
      updated_at: Timestamp.fromDate(note.updated_at),
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): Note {
    const d = snapshot.data(options)
    return {
      id: snapshot.id,
      title: d.title,
      content: d.content ?? '',
      linked_todo_id: d.linked_todo_id ?? undefined,
      created_at: toDate(d.created_at) ?? new Date(),
      updated_at: toDate(d.updated_at) ?? new Date(),
    }
  },
}

// --- Preferences Converter ---

export const preferencesConverter: FirestoreDataConverter<UserPreferences> = {
  toFirestore(prefs: UserPreferences): DocumentData {
    return {
      current_energy: prefs.current_energy ?? null,
      theme: prefs.theme,
      notifications_enabled: prefs.notifications_enabled,
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): UserPreferences {
    const d = snapshot.data(options)
    return {
      current_energy: d.current_energy ?? undefined,
      theme: d.theme ?? 'system',
      notifications_enabled: d.notifications_enabled ?? false,
    }
  },
}

// --- Today Set Converter ---

export const todaySetConverter: FirestoreDataConverter<TodaySet> = {
  toFirestore(set: TodaySet): DocumentData {
    return {
      date: set.date,
      todo_ids: set.todo_ids,
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): TodaySet {
    const d = snapshot.data(options)
    return {
      date: d.date ?? '',
      todo_ids: d.todo_ids ?? [],
    }
  },
}
