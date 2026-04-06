import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useTodos } from '@/hooks/useTodos'
import { useTodaySet } from '@/hooks/useTodaySet'
import { usePreferences } from '@/hooks/usePreferences'
import { useTimer, formatElapsed, formatMinutes, defaultEstimate } from '@/hooks/useTimer'
import { useCompletionToast } from '@/hooks/useCompletionToast'
import { CompletionToast } from '@/components/ui/CompletionToast'

type TransitionFeel = 'good' | 'meh' | 'tough'

function getEstimate(todo: { estimated_minutes?: number; size?: string }): number {
  return todo.estimated_minutes ?? defaultEstimate(todo.size)
}

export function FocusModePage() {
  const navigate = useNavigate()
  const { todos, pinned, completeTodo, deferTodo, dismissFromToday, addTodo, loading: todosLoading } = useTodos()
  const { preferences } = usePreferences()
  const { todayTodos, loading: setLoading, dismissFromSet } = useTodaySet(todos, pinned, preferences.current_energy)
  const timer = useTimer()
  const { message: toastMessage, trigger: triggerToast, dismiss: dismissToast } = useCompletionToast()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [phase, setPhase] = useState<'focus' | 'transition' | 'break'>('focus')
  const [showNext, setShowNext] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureFlash, setCaptureFlash] = useState(false)
  const captureRef = useRef<HTMLInputElement>(null)

  const loading = todosLoading || setLoading
  const currentTodo = todayTodos[currentIndex]
  const nextTodo = todayTodos[currentIndex + 1]
  const estimateMin = currentTodo ? getEstimate(currentTodo) : 0
  const estimateSec = estimateMin * 60
  const progress = estimateSec > 0 ? Math.min((timer.elapsedSeconds / estimateSec) * 100, 100) : 0
  const isOvertime = timer.elapsedSeconds > estimateSec

  // Auto-start timer on the current task
  useEffect(() => {
    if (currentTodo && phase === 'focus' && !timer.isRunning) {
      timer.start(currentTodo.id)
    }
  }, [currentTodo?.id, phase])

  // Escape exits focus mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/today')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const advanceToNext = useCallback(() => {
    if (nextTodo) {
      setCurrentIndex((i) => i + 1)
      setPhase('focus')
      setShowNext(false)
      timer.start(nextTodo.id)
    } else {
      timer.stop()
      navigate('/today')
    }
  }, [nextTodo, timer, navigate])

  const handleComplete = useCallback(() => {
    if (!currentTodo) return
    timer.stop()
    completeTodo(currentTodo.id)
    triggerToast(currentTodo.title)
    setPhase('transition')
    // Auto-advance after breathing space
    setTimeout(() => advanceToNext(), 3500)
  }, [currentTodo, timer, completeTodo, triggerToast, advanceToNext])

  const handleSkip = useCallback(() => {
    if (!currentTodo) return
    timer.stop()
    advanceToNext()
  }, [currentTodo, timer, advanceToNext])

  const handleBreak = useCallback(() => {
    timer.pause()
    setPhase('break')
  }, [timer])

  const handleResumeFromBreak = useCallback(() => {
    timer.resume()
    setPhase('focus')
  }, [timer])

  const handleDefer = useCallback(() => {
    if (!currentTodo) return
    timer.stop()
    if (currentTodo.status === 'today_pinned') {
      deferTodo(currentTodo.id)
    } else {
      dismissFromSet(currentTodo.id)
      dismissFromToday(currentTodo.id)
    }
    advanceToNext()
  }, [currentTodo, timer, deferTodo, dismissFromSet, dismissFromToday, advanceToNext])

  const handleCapture = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const text = captureText.trim()
    if (!text) return
    await addTodo({ title: text, status: 'inbox' })
    setCaptureText('')
    setCaptureFlash(true)
    setTimeout(() => setCaptureFlash(false), 600)
  }, [captureText, addTodo])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant text-sm">Loading...</p>
      </div>
    )
  }

  if (!currentTodo) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-on-surface">All done</h1>
        <p className="text-on-surface-variant text-sm text-center">
          Nothing left on your plate. Nice work.
        </p>
        <button
          onClick={() => navigate('/today')}
          className="mt-4 px-6 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
        >
          Back to Today
        </button>
      </div>
    )
  }

  // --- Progress ring SVG ---
  const ringSize = 200
  const strokeWidth = 6
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar: exit + task count */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => { timer.stop(); navigate('/today') }}
          className="text-on-surface-variant text-sm hover:text-on-surface transition-colors cursor-pointer"
        >
          ← Today
        </button>
        <span className="text-on-surface-variant text-xs">
          {currentIndex + 1} of {todayTodos.length}
        </span>
      </div>

      {/* Main content — centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {/* Transition breathing phase */}
        {phase === 'transition' && (
          <div className="flex flex-col items-center gap-6 animate-focus-breathe">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12l5 5L19 7" />
              </svg>
            </div>
            <p className="text-on-surface-variant text-sm">Take a breath...</p>
          </div>
        )}

        {/* Break phase */}
        {phase === 'break' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center">
              <span className="text-3xl">☕</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-on-surface">Taking a break</h2>
            <p className="text-on-surface-variant text-sm">
              Timer paused at {formatElapsed(timer.elapsedSeconds)}
            </p>
            <button
              onClick={handleResumeFromBreak}
              className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
            >
              Resume
            </button>
          </div>
        )}

        {/* Focus phase — main task view */}
        {phase === 'focus' && (
          <>
            {/* Timer ring */}
            <div className="relative">
              <svg
                width={ringSize}
                height={ringSize}
                className="transform -rotate-90"
              >
                {/* Background ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  className="stroke-surface-container-high"
                />
                {/* Progress ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ease-linear ${isOvertime ? 'stroke-primary/40' : 'stroke-primary'}`}
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: offset,
                  }}
                />
              </svg>
              {/* Time display inside ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-mono tabular-nums font-light ${isOvertime ? 'text-primary' : 'text-on-surface'}`}>
                  {formatElapsed(timer.elapsedSeconds)}
                </span>
                <span className="text-on-surface-variant text-xs mt-1">
                  of {formatMinutes(estimateMin)}
                </span>
              </div>
            </div>

            {/* Task title */}
            <div className="text-center max-w-md">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface leading-snug">
                {currentTodo.title}
              </h1>
              {currentTodo.project && (
                <p className="text-on-surface-variant text-sm mt-2">{currentTodo.project}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleDefer}
                className="px-5 py-3 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
              >
                Not now
              </button>
              <button
                onClick={handleComplete}
                className="px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer min-h-[44px]"
              >
                Done
              </button>
              <button
                onClick={handleSkip}
                className="px-5 py-3 rounded-xl bg-surface-container text-on-surface-variant text-sm font-medium hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer min-h-[44px]"
              >
                Skip
              </button>
            </div>

            {/* Break button */}
            <button
              onClick={handleBreak}
              className="text-on-surface-variant/50 text-xs hover:text-on-surface-variant transition-colors cursor-pointer"
            >
              Take a break
            </button>

            {/* Peek next */}
            {nextTodo && (
              <button
                onClick={() => setShowNext(!showNext)}
                className="text-on-surface-variant/40 text-xs hover:text-on-surface-variant transition-colors cursor-pointer"
              >
                {showNext ? (
                  <span>Up next: <span className="text-on-surface-variant">{nextTodo.title}</span></span>
                ) : (
                  'Peek at what\'s next'
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Bottom: quick capture bar */}
      <div className="px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleCapture} className="flex items-center gap-2">
          <div className={`flex-1 flex items-center gap-2 bg-surface-container-low rounded-xl px-4 py-2.5 border transition-colors ${captureFlash ? 'border-primary/40' : 'border-outline-variant/15'}`}>
            <span className="text-on-surface-variant/40 text-sm">↓</span>
            <input
              ref={captureRef}
              type="text"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder="Capture a thought to Inbox..."
              className="flex-1 bg-transparent text-on-surface text-sm outline-none placeholder:text-on-surface-variant/40"
            />
          </div>
          {captureText.trim() && (
            <button
              type="submit"
              className="px-3 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary-dim transition-colors cursor-pointer"
            >
              Save
            </button>
          )}
        </form>
      </div>

      {toastMessage && (
        <CompletionToast message={toastMessage} onDismiss={dismissToast} />
      )}
    </div>
  )
}
