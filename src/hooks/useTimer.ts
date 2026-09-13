import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Persisted shape. Elapsed time is derived from wall-clock timestamps rather
 * than counted by an interval, so a backgrounded or throttled tab can't lose
 * seconds, and a closed tab picks up where it left off. A timer whose first
 * start was on another calendar day is stale (nobody works a 23-hour task) and
 * is discarded on load and on the next tick.
 */
interface TimerState {
  activeTaskId: string | null
  /** Wall-clock ms of the first start; decides which day the timer belongs to. */
  startedAt: number
  /** Seconds banked before the current run (i.e. across pauses). */
  accumulatedSeconds: number
  /** Wall-clock ms when the current run started; null while paused or stopped. */
  runningSince: number | null
}

const STORAGE_KEY = 'tempo-timer-state'
const IDLE: TimerState = { activeTaskId: null, startedAt: 0, accumulatedSeconds: 0, runningSince: null }

function isStale(state: TimerState, now: number): boolean {
  return state.activeTaskId !== null && new Date(state.startedAt).toDateString() !== new Date(now).toDateString()
}

function loadState(): TimerState {
  let parsed: Partial<TimerState> | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    parsed = raw ? (JSON.parse(raw) as Partial<TimerState>) : null
  } catch {
    return IDLE
  }
  if (
    !parsed ||
    typeof parsed.activeTaskId !== 'string' ||
    typeof parsed.accumulatedSeconds !== 'number' ||
    typeof parsed.startedAt !== 'number'
  ) {
    return IDLE
  }
  const state: TimerState = {
    activeTaskId: parsed.activeTaskId,
    startedAt: parsed.startedAt,
    accumulatedSeconds: parsed.accumulatedSeconds,
    runningSince: typeof parsed.runningSince === 'number' ? parsed.runningSince : null,
  }
  return isStale(state, Date.now()) ? IDLE : state
}

function saveState(state: TimerState) {
  try {
    if (state.activeTaskId) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Storage blocked (private mode, quota): the timer still works, it just won't survive a reload.
  }
}

function elapsedAt(state: TimerState, now: number): number {
  const running = state.runningSince ? Math.floor((now - state.runningSince) / 1000) : 0
  return state.accumulatedSeconds + Math.max(0, running)
}

export interface UseTimerResult {
  activeTaskId: string | null
  elapsedSeconds: number
  isRunning: boolean
  isPaused: boolean
  start: (taskId: string) => void
  pause: () => void
  resume: () => void
  /** Stops the timer and returns the final elapsed seconds. */
  stop: () => number
  reset: (taskId: string) => void
}

export function useTimer(): UseTimerResult {
  const [state, setState] = useState<TimerState>(loadState)
  const [now, setNow] = useState(() => Date.now())
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    saveState(state)
  }, [state])

  // Re-render once a second while running. The interval carries no state, so
  // throttling only delays the display; it never loses time.
  useEffect(() => {
    if (!state.runningSince) return
    const id = setInterval(() => {
      const now = Date.now()
      setNow(now)
      setState((prev) => (isStale(prev, now) ? IDLE : prev))
    }, 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [state.runningSince])

  // Keep two open tabs (Today + Focus Mode) in agreement.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(loadState())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const start = useCallback((taskId: string) => {
    const now = Date.now()
    setState({ activeTaskId: taskId, startedAt: now, accumulatedSeconds: 0, runningSince: now })
  }, [])

  const pause = useCallback(() => {
    setState((prev) => {
      if (!prev.runningSince) return prev
      return { ...prev, accumulatedSeconds: elapsedAt(prev, Date.now()), runningSince: null }
    })
  }, [])

  const resume = useCallback(() => {
    setState((prev) => {
      if (!prev.activeTaskId || prev.runningSince) return prev
      return { ...prev, runningSince: Date.now() }
    })
  }, [])

  const stop = useCallback(() => {
    const elapsed = elapsedAt(stateRef.current, Date.now())
    setState(IDLE)
    return elapsed
  }, [])

  return {
    activeTaskId: state.activeTaskId,
    elapsedSeconds: elapsedAt(state, now),
    isRunning: state.activeTaskId !== null,
    isPaused: state.activeTaskId !== null && state.runningSince === null,
    start,
    pause,
    resume,
    stop,
    reset: start,
  }
}
