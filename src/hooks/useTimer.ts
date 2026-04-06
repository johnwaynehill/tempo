import { useState, useEffect, useCallback, useRef } from 'react'

interface TimerState {
  activeTaskId: string | null
  elapsedSeconds: number
  isRunning: boolean
  isPaused: boolean
  startedAt: number | null // timestamp ms
}

const STORAGE_KEY = 'tempo-timer-state'

function loadState(): TimerState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TimerState
      // If timer was running, calculate elapsed time since page was open
      if (parsed.isRunning && parsed.startedAt) {
        const additionalSeconds = Math.floor((Date.now() - parsed.startedAt) / 1000)
        parsed.elapsedSeconds += additionalSeconds
        parsed.startedAt = Date.now()
      }
      return parsed
    }
  } catch {}
  return { activeTaskId: null, elapsedSeconds: 0, isRunning: false, isPaused: false, startedAt: null }
}

function saveState(state: TimerState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export interface UseTimerResult {
  activeTaskId: string | null
  elapsedSeconds: number
  isRunning: boolean
  isPaused: boolean
  start: (taskId: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: (taskId: string) => void
}

export function useTimer(): UseTimerResult {
  const [state, setState] = useState<TimerState>(loadState)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Persist state changes
  useEffect(() => {
    saveState(state)
  }, [state])

  // Tick interval
  useEffect(() => {
    if (state.isRunning && !state.isPaused) {
      intervalRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1,
        }))
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.isRunning, state.isPaused])

  const start = useCallback((taskId: string) => {
    setState({
      activeTaskId: taskId,
      elapsedSeconds: 0,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
    })
  }, [])

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: true, startedAt: null }))
  }, [])

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: false, startedAt: Date.now() }))
  }, [])

  const stop = useCallback(() => {
    setState({ activeTaskId: null, elapsedSeconds: 0, isRunning: false, isPaused: false, startedAt: null })
  }, [])

  const reset = useCallback((taskId: string) => {
    setState({
      activeTaskId: taskId,
      elapsedSeconds: 0,
      isRunning: true,
      isPaused: false,
      startedAt: Date.now(),
    })
  }, [])

  return {
    activeTaskId: state.activeTaskId,
    elapsedSeconds: state.elapsedSeconds,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    start,
    pause,
    resume,
    stop,
    reset,
  }
}

/** Format seconds as "12:45" or "1:02:30" */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Format minutes as "1h 30m" or "25m" */
export function formatMinutes(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins}m`
}

/** Get default estimate based on todo size */
export function defaultEstimate(size?: string): number {
  switch (size) {
    case 'small': return 15
    case 'medium': return 30
    case 'large': return 60
    default: return 25
  }
}
