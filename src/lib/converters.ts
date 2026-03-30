import {
  type DocumentData,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
  type FirestoreDataConverter,
  Timestamp,
} from 'firebase/firestore'
import type { Todo, Note, Habit, CalendarEvent, UserPreferences, TodaySet, WeeklyReview } from '@/types'

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
      recurrence: todo.recurrence ?? null,
      recurrence_parent_id: todo.recurrence_parent_id ?? null,
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
      recurrence: d.recurrence ?? undefined,
      recurrence_parent_id: d.recurrence_parent_id ?? undefined,
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
      inline_todo_map: note.inline_todo_map ?? null,
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
      inline_todo_map: d.inline_todo_map ?? undefined,
      created_at: toDate(d.created_at) ?? new Date(),
      updated_at: toDate(d.updated_at) ?? new Date(),
    }
  },
}

// --- Habit Converter ---

export const habitConverter: FirestoreDataConverter<Habit> = {
  toFirestore(habit: Habit): DocumentData {
    return {
      name: habit.name,
      description: habit.description ?? null,
      frequency: habit.frequency,
      archived: habit.archived,
      completions: habit.completions,
      created_at: Timestamp.fromDate(habit.created_at),
      updated_at: Timestamp.fromDate(habit.updated_at),
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): Habit {
    const d = snapshot.data(options)
    return {
      id: snapshot.id,
      name: d.name,
      description: d.description ?? undefined,
      frequency: d.frequency ?? 'daily',
      archived: d.archived ?? false,
      completions: d.completions ?? {},
      created_at: toDate(d.created_at) ?? new Date(),
      updated_at: toDate(d.updated_at) ?? new Date(),
    }
  },
}

// --- Calendar Event Converter ---

export const eventConverter: FirestoreDataConverter<CalendarEvent> = {
  toFirestore(event: CalendarEvent): DocumentData {
    return {
      title: event.title,
      start_time: Timestamp.fromDate(event.start_time),
      end_time: Timestamp.fromDate(event.end_time),
      all_day: event.all_day,
      description: event.description ?? null,
      location: event.location ?? null,
      color: event.color ?? null,
      created_at: Timestamp.fromDate(event.created_at),
      updated_at: Timestamp.fromDate(event.updated_at),
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): CalendarEvent {
    const d = snapshot.data(options)
    return {
      id: snapshot.id,
      title: d.title,
      start_time: toDate(d.start_time) ?? new Date(),
      end_time: toDate(d.end_time) ?? new Date(),
      all_day: d.all_day ?? false,
      description: d.description ?? undefined,
      location: d.location ?? undefined,
      color: d.color ?? undefined,
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

// --- Weekly Review Converter ---

export const reviewConverter: FirestoreDataConverter<WeeklyReview> = {
  toFirestore(review: WeeklyReview): DocumentData {
    return {
      reflection: review.reflection,
      created_at: Timestamp.fromDate(review.created_at),
      updated_at: Timestamp.fromDate(review.updated_at),
    }
  },

  fromFirestore(
    snapshot: QueryDocumentSnapshot,
    options?: SnapshotOptions,
  ): WeeklyReview {
    const d = snapshot.data(options)
    return {
      id: snapshot.id,
      reflection: d.reflection ?? '',
      created_at: toDate(d.created_at) ?? new Date(),
      updated_at: toDate(d.updated_at) ?? new Date(),
    }
  },
}
