import { useState, useEffect, useRef, useCallback } from 'react'
import { useInstance } from '@milkdown/react'
import { commandsCtx } from '@milkdown/kit/core'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  toggleLinkCommand,
  createCodeBlockCommand,
  insertHrCommand,
} from '@milkdown/kit/preset/commonmark'
import { toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'

// --- Button definitions (mirrors desktop toolbar) ---

interface ButtonDef {
  command: string
  label: string
  icon: string
}

const buttons: (ButtonDef | 'sep')[] = [
  {
    command: 'bold',
    label: 'Bold',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>',
  },
  {
    command: 'italic',
    label: 'Italic',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  },
  {
    command: 'strikethrough',
    label: 'Strikethrough',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 00-2.83 4"/><path d="M14 12a4 4 0 010 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>',
  },
  {
    command: 'code',
    label: 'Code',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  },
  'sep',
  {
    command: 'h1',
    label: 'H1',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v10"/></svg>',
  },
  {
    command: 'h2',
    label: 'H2',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>',
  },
  {
    command: 'h3',
    label: 'H3',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 01-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 00-2-2"/></svg>',
  },
  'sep',
  {
    command: 'quote',
    label: 'Quote',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
  },
  {
    command: 'code-block',
    label: 'Code block',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 8 5 12 9 16"/><polyline points="15 8 19 12 15 16"/></svg>',
  },
  {
    command: 'hr',
    label: 'Divider',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="7" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  },
  'sep',
  {
    command: 'bullet-list',
    label: 'Bullet list',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  },
  {
    command: 'ordered-list',
    label: 'Ordered list',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
  },
  'sep',
  {
    command: 'link',
    label: 'Link',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
  },
]

// --- Component ---

export function MobileFormatBar() {
  const [loading, getInstance] = useInstance()
  const [visible, setVisible] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)

  // Track whether the ProseMirror editor is focused
  useEffect(() => {
    if (loading) return

    const editorRoot = document.querySelector('.ProseMirror')
    if (!editorRoot) return

    const handleFocus = () => setVisible(true)
    const handleBlur = () => {
      // Small delay to allow button taps to register before hiding
      setTimeout(() => {
        if (!document.querySelector('.ProseMirror:focus-within') &&
            !document.activeElement?.closest('.mobile-format-bar')) {
          setVisible(false)
        }
      }, 150)
    }

    editorRoot.addEventListener('focus', handleFocus)
    editorRoot.addEventListener('blur', handleBlur)

    // Check if already focused
    if (editorRoot.contains(document.activeElement)) {
      setVisible(true)
    }

    return () => {
      editorRoot.removeEventListener('focus', handleFocus)
      editorRoot.removeEventListener('blur', handleBlur)
    }
  }, [loading])

  // Position above the virtual keyboard using visualViewport API
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop
      setBottomOffset(Math.max(0, offset))
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const runCommand = useCallback(
    (command: string) => {
      if (loading) return

      const editor = getInstance()
      if (!editor) return

      editor.action((ctx) => {
        const commands = ctx.get(commandsCtx)

        switch (command) {
          case 'bold':
            commands.call(toggleStrongCommand.key)
            break
          case 'italic':
            commands.call(toggleEmphasisCommand.key)
            break
          case 'code':
            commands.call(toggleInlineCodeCommand.key)
            break
          case 'h1':
            commands.call(wrapInHeadingCommand.key, 1)
            break
          case 'h2':
            commands.call(wrapInHeadingCommand.key, 2)
            break
          case 'h3':
            commands.call(wrapInHeadingCommand.key, 3)
            break
          case 'quote':
            commands.call(wrapInBlockquoteCommand.key)
            break
          case 'bullet-list':
            commands.call(wrapInBulletListCommand.key)
            break
          case 'ordered-list':
            commands.call(wrapInOrderedListCommand.key)
            break
          case 'strikethrough':
            commands.call(toggleStrikethroughCommand.key)
            break
          case 'code-block':
            commands.call(createCodeBlockCommand.key)
            break
          case 'hr':
            commands.call(insertHrCommand.key)
            break
          case 'link': {
            const href = window.prompt('URL')
            if (href !== null) {
              commands.call(toggleLinkCommand.key, { href })
            }
            break
          }
        }
      })

      // Refocus the editor after command
      const pm = document.querySelector('.ProseMirror') as HTMLElement | null
      pm?.focus()
    },
    [loading, getInstance],
  )

  if (!visible) return null

  return (
    <div
      ref={barRef}
      className="mobile-format-bar md:hidden fixed left-0 right-0 z-50"
      style={{ bottom: `${bottomOffset}px` }}
    >
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-surface-container-low border-t border-outline-variant/20 overflow-x-auto scrollbar-hide">
        {buttons.map((item, i) =>
          item === 'sep' ? (
            <div
              key={`sep-${i}`}
              className="w-px h-5 bg-outline-variant/30 mx-1 shrink-0"
            />
          ) : (
            <button
              key={item.command}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runCommand(item.command)}
              aria-label={item.label}
              className="flex items-center justify-center w-11 h-11 rounded-lg text-on-surface-variant hover:bg-surface-container-high active:bg-primary-container active:text-primary transition-colors shrink-0 cursor-pointer"
              dangerouslySetInnerHTML={{ __html: item.icon }}
            />
          ),
        )}
      </div>
    </div>
  )
}
