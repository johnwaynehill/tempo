import { useState } from 'react'
import { Link } from 'react-router'
import { useTodos } from '@/hooks/useTodos'
import { MenuButton } from '@/components/ui/MenuButton'

export function BrainDumpPage() {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState<number | null>(null)
  const { addTodo } = useTodos()

  const lineCount = text.split('\n').filter((l) => l.trim()).length

  const handleProcess = async () => {
    const items = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (items.length === 0) return

    setSending(true)
    await Promise.all(items.map((title) => addTodo({ title })))
    setSentCount(items.length)
    setText('')
    setSending(false)
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
            Brain Dump
          </h1>
          <p className="text-on-surface-variant text-sm">
            Get it out of your head. One thought per line.
          </p>
        </div>
        <MenuButton />
      </div>

      {/* Confirmation banner */}
      {sentCount !== null && (
        <div className="mb-6 bg-primary/8 rounded-xl px-5 py-4 flex items-center justify-between">
          <p className="text-on-surface text-sm">
            Sent {sentCount} item{sentCount !== 1 ? 's' : ''} to Inbox.
          </p>
          <Link
            to="/inbox"
            className="text-primary text-sm font-medium hover:underline"
          >
            View Inbox
          </Link>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          // Clear the sent banner when user starts typing again
          if (sentCount !== null) setSentCount(null)
        }}
        placeholder="Buy groceries&#10;Email dentist&#10;Research that thing&#10;..."
        className="w-full bg-surface-container-lowest rounded-xl p-5 text-on-surface placeholder:text-on-surface-variant/40 outline-none text-[15px] leading-relaxed min-h-[40vh] resize-none"
      />

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-on-surface-variant">
          {lineCount} item{lineCount !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleProcess}
          disabled={lineCount === 0 || sending}
          className="px-5 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium disabled:opacity-40 transition-all duration-200 hover:shadow-md cursor-pointer"
        >
          {sending ? 'Sending...' : 'Send to Inbox'}
        </button>
      </div>
    </div>
  )
}
