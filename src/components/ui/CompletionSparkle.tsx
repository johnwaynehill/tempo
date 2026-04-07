import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Particle {
  id: number
  x: number
  y: number
  angle: number
  distance: number
  size: number
  delay: number
}

interface CompletionSparkleProps {
  x: number
  y: number
  onComplete: () => void
}

function generateParticles(): Particle[] {
  const count = 6
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 0,
    y: 0,
    angle: (360 / count) * i + (Math.random() * 30 - 15),
    distance: 16 + Math.random() * 14,
    size: 3 + Math.random() * 3,
    delay: Math.random() * 80,
  }))
}

export function CompletionSparkle({ x, y, onComplete }: CompletionSparkleProps) {
  const [particles] = useState(generateParticles)
  const [visible, setVisible] = useState(true)

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (prefersReducedMotion) {
      onComplete()
      return
    }
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onComplete, 100)
    }, 500)
    return () => clearTimeout(timer)
  }, [onComplete, prefersReducedMotion])

  if (prefersReducedMotion || !visible) return null

  return createPortal(
    <div
      className="fixed pointer-events-none z-[100]"
      style={{ left: x, top: y }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180
        const tx = Math.cos(rad) * p.distance
        const ty = Math.sin(rad) * p.distance

        return (
          <span
            key={p.id}
            className="absolute rounded-full animate-sparkle-burst"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: 'var(--color-primary)',
              animationDelay: `${p.delay}ms`,
              '--sparkle-tx': `${tx}px`,
              '--sparkle-ty': `${ty}px`,
            } as React.CSSProperties}
          />
        )
      })}
    </div>,
    document.body,
  )
}
