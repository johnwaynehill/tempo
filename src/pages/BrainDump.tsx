import { useState } from 'react'

export function BrainDumpPage() {
  const [text, setText] = useState('')

  const lineCount = text.split('\n').filter((l) => l.trim()).length

  const handleProcess = () => {
    // TODO: Split by newlines, create inbox items in Firestore
    const items = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    console.log('Brain dump → Inbox:', items)
    setText('')
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-on-surface tracking-tight mb-1">
          Brain Dump
        </h1>
        <p className="text-on-surface-variant text-sm">
          Get it out of your head. One thought per line.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Buy groceries&#10;Email dentist&#10;Research that thing&#10;..."
        className="w-full bg-surface-container-lowest rounded-xl p-5 text-on-surface placeholder:text-on-surface-variant/40 outline-none text-[15px] leading-relaxed min-h-[40vh] resize-none"
      />

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-on-surface-variant">
          {lineCount} item{lineCount !== 1 ? 's' : ''}
        </span>
        <button
          onClick={handleProcess}
          disabled={lineCount === 0}
          className="px-5 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium disabled:opacity-40 transition-all duration-200 hover:shadow-md cursor-pointer"
        >
          Send to Inbox
        </button>
      </div>
    </div>
  )
}
