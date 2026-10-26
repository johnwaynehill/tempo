import { useState } from 'react'

interface AvatarProps {
  photoURL: string | null | undefined
  name: string | null | undefined
  /** Diameter in px. */
  size?: number
}

/**
 * The signed-in user's photo, or their initial when there's no photo (API-key and dev
 * sign-ins) or it fails to load. Never renders `<img src="">`, which browsers warn about
 * and which re-requests the current page.
 */
export function Avatar({ photoURL, name, size = 32 }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size }

  if (photoURL && !failed) {
    return (
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className="rounded-full shrink-0 object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: Math.round(size * 0.45) }}
      className="rounded-full shrink-0 bg-primary/15 text-primary font-semibold flex items-center justify-center leading-none"
    >
      {name?.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
