import { useState } from 'react'
import { EnergySelector } from '@/components/ui/EnergySelector'
import { TodoItem } from '@/components/ui/TodoItem'
import { useTodos } from '@/hooks/useTodos'
import type { EnergyLevel } from '@/types'

export function BacklogPage() {
  const { backlog, completeTodo, deferTodo, loading } = useTodos()
  const [energyFilter, setEnergyFilter] = useState<EnergyLevel | undefined>(undefined)

  const filtered = energyFilter
    ? backlog.filter((t) => t.energy_level === energyFilter)
    : backlog

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Backlog
        </h1>
        <p className="text-on-surface-variant text-sm">
          {backlog.length} total &middot; {filtered.length} showing
        </p>
      </div>

      {/* Energy filter */}
      <div className="mb-8">
        <EnergySelector
          value={energyFilter}
          onChange={(level) =>
            setEnergyFilter(energyFilter === level ? undefined : level)
          }
        />
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8">Loading...</p>
      ) : (
        <>
          <div className="space-y-0">
            {filtered.map((todo) => (
              <TodoItem
                key={todo.id}
                todo={todo}
                onComplete={completeTodo}
                onDefer={deferTodo}
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
        </>
      )}
    </div>
  )
}
