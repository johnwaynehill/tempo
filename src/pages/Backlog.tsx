import { useState } from 'react'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import type { EnergyLevel, Todo } from '@/types'

// Placeholder — will be replaced with Firestore query
const MOCK_BACKLOG: Todo[] = [
  {
    id: '20',
    title: 'Build the Milkdown note editor component',
    status: 'backlog',
    energy_level: 'high',
    project: 'Tempo',
    impact: 5,
    created_at: new Date(Date.now() - 3 * 86400000),
    updated_at: new Date(),
  },
  {
    id: '21',
    title: 'Design the settings page layout',
    status: 'backlog',
    energy_level: 'medium',
    project: 'Tempo',
    impact: 3,
    created_at: new Date(Date.now() - 7 * 86400000),
    updated_at: new Date(),
  },
  {
    id: '22',
    title: 'Organize browser bookmarks',
    status: 'backlog',
    energy_level: 'low',
    impact: 1,
    created_at: new Date(Date.now() - 14 * 86400000),
    updated_at: new Date(),
  },
]

export function BacklogPage() {
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(undefined)

  const filtered = energyFilter
    ? MOCK_BACKLOG.filter((t) => t.energy_level === energyFilter)
    : MOCK_BACKLOG

  const handleComplete = (id: string) => {
    console.log('Complete:', id)
  }

  const handleDefer = (id: string) => {
    console.log('Defer:', id)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Backlog
        </h1>
        <p className="text-on-surface-variant text-sm">
          {MOCK_BACKLOG.length} total &middot; {filtered.length} showing
        </p>
      </div>

      {/* Energy filter */}
      <div className="mb-8">
        <EnergySelector value={energyFilter} onChange={(level) =>
          setEnergyFilter(energyFilter === level ? undefined : level)
        } />
      </div>

      <div className="space-y-0">
        {filtered.map((todo) => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onComplete={handleComplete}
            onDefer={handleDefer}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-on-surface-variant text-sm">
            {energyFilter ? 'No tasks at this energy level.' : 'Backlog is empty.'}
          </p>
        </div>
      )}
    </div>
  )
}
