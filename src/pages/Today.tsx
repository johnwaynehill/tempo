import { useState } from 'react'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import type { EnergyLevel, Todo } from '@/types'

// Placeholder data for scaffolding — will be replaced with Firestore hooks
const MOCK_TODOS: Todo[] = [
  {
    id: '1',
    title: 'Review the Tempo design system tokens',
    status: 'today_pinned',
    energy_level: 'medium',
    project: 'Tempo',
    impact: 4,
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '2',
    title: 'Set up Firebase project and security rules',
    status: 'backlog',
    energy_level: 'high',
    project: 'Tempo',
    impact: 5,
    created_at: new Date(Date.now() - 2 * 86400000),
    updated_at: new Date(),
  },
  {
    id: '3',
    title: 'Write a brain dump of feature ideas',
    status: 'backlog',
    energy_level: 'low',
    impact: 2,
    created_at: new Date(Date.now() - 5 * 86400000),
    updated_at: new Date(),
  },
]

export function TodayPage() {
  const [energy, setEnergy] = useState<EnergyLevel | undefined>(undefined)

  const handleComplete = (id: string) => {
    console.log('Complete:', id)
    // TODO: Update Firestore document status → 'done'
  }

  const handleDefer = (id: string) => {
    console.log('Defer:', id)
    // TODO: Update Firestore document status → 'deferred'
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Today
        </h1>
        <p className="text-on-surface-variant text-sm">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Energy selector — always visible per PRD §7.5 */}
      <div className="mb-8">
        <EnergySelector value={energy} onChange={setEnergy} />
      </div>

      {/* Today's tasks */}
      <div className="space-y-0">
        {MOCK_TODOS.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={handleComplete}
            onDefer={handleDefer}
          />
        ))}
      </div>

      {/* Empty state */}
      {MOCK_TODOS.length === 0 && (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            Nothing on your plate. Enjoy the quiet.
          </p>
        </div>
      )}
    </div>
  )
}
