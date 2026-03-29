import type { Ctx } from '@milkdown/kit/ctx'
import type { EditorView } from '@milkdown/kit/prose/view'
import { tooltipFactory, TooltipProvider } from '@milkdown/kit/plugin/tooltip'
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
} from '@milkdown/kit/preset/commonmark'

// --- Tooltip plugin factory ---

export const formatToolbar = tooltipFactory('FORMAT_TOOLBAR')

// --- SVG Icons (Lucide-style, 18x18 viewBox, 2px stroke) ---

const icons: Record<string, string> = {
  bold: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>',
  italic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>',
  code: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  h1: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v10"/></svg>',
  h2: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>',
  h3: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 01-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 00-2-2"/></svg>',
  quote: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
  'bullet-list': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  'ordered-list': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>',
  link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
}

// --- Button config ---

interface ButtonDef {
  command: string
  label: string
  shortcut?: string
}

const buttonGroups: ButtonDef[][] = [
  [
    { command: 'bold', label: 'Bold', shortcut: 'Ctrl+B' },
    { command: 'italic', label: 'Italic', shortcut: 'Ctrl+I' },
    { command: 'code', label: 'Inline Code' },
  ],
  [
    { command: 'h1', label: 'Heading 1' },
    { command: 'h2', label: 'Heading 2' },
    { command: 'h3', label: 'Heading 3' },
  ],
  [
    { command: 'quote', label: 'Blockquote' },
  ],
  [
    { command: 'bullet-list', label: 'Bullet List' },
    { command: 'ordered-list', label: 'Ordered List' },
  ],
  [
    { command: 'link', label: 'Link' },
  ],
]

// --- Build toolbar DOM ---

function createToolbarElement(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'milkdown-format-toolbar'

  const scroll = document.createElement('div')
  scroll.className = 'milkdown-format-toolbar-scroll'

  buttonGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      const sep = document.createElement('div')
      sep.className = 'milkdown-format-toolbar-sep'
      scroll.appendChild(sep)
    }

    group.forEach(({ command, label, shortcut }) => {
      const btn = document.createElement('button')
      btn.setAttribute('data-command', command)
      btn.setAttribute('aria-label', label)
      btn.setAttribute('title', shortcut ? `${label} (${shortcut})` : label)
      btn.innerHTML = icons[command] ?? ''
      scroll.appendChild(btn)
    })
  })

  wrapper.appendChild(scroll)
  return wrapper
}

// --- Active state detection ---

function updateActiveStates(toolbar: HTMLElement, view: EditorView) {
  const { state } = view
  const { from, $from, to } = state.selection

  // Mark checks
  const markChecks: [string, string][] = [
    ['bold', 'strong'],
    ['italic', 'emphasis'],
    ['code', 'code_inline'],
  ]

  for (const [cmd, markName] of markChecks) {
    const markType = state.schema.marks[markName]
    const btn = toolbar.querySelector(`[data-command="${cmd}"]`)
    if (!btn || !markType) continue

    const isActive =
      state.doc.rangeHasMark(from, to, markType) ||
      !!markType.isInSet(state.storedMarks || $from.marks())
    btn.classList.toggle('active', isActive)
  }

  // Block checks: headings
  const parentNode = $from.parent
  for (const level of [1, 2, 3]) {
    const btn = toolbar.querySelector(`[data-command="h${level}"]`)
    if (!btn) continue
    const isActive =
      parentNode.type.name === 'heading' && parentNode.attrs.level === level
    btn.classList.toggle('active', isActive)
  }

  // Block checks: blockquote (check ancestors)
  const quoteBtn = toolbar.querySelector('[data-command="quote"]')
  if (quoteBtn) {
    let inBlockquote = false
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'blockquote') {
        inBlockquote = true
        break
      }
    }
    quoteBtn.classList.toggle('active', inBlockquote)
  }

  // Block checks: lists
  const bulletBtn = toolbar.querySelector('[data-command="bullet-list"]')
  const orderedBtn = toolbar.querySelector('[data-command="ordered-list"]')
  if (bulletBtn || orderedBtn) {
    let listType: string | null = null
    for (let d = $from.depth; d > 0; d--) {
      const name = $from.node(d).type.name
      if (name === 'bullet_list' || name === 'ordered_list') {
        listType = name
        break
      }
    }
    bulletBtn?.classList.toggle('active', listType === 'bullet_list')
    orderedBtn?.classList.toggle('active', listType === 'ordered_list')
  }

  // Link
  const linkBtn = toolbar.querySelector('[data-command="link"]')
  if (linkBtn) {
    const linkMark = state.schema.marks['link']
    const isActive = linkMark
      ? state.doc.rangeHasMark(from, to, linkMark) ||
        !!linkMark.isInSet(state.storedMarks || $from.marks())
      : false
    linkBtn.classList.toggle('active', isActive)
  }
}

// --- Command dispatch ---

function dispatchCommand(ctx: Ctx, command: string) {
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
    case 'link': {
      const href = window.prompt('URL')
      if (href !== null) {
        commands.call(toggleLinkCommand.key, { href })
      }
      break
    }
  }
}

// --- Configure the tooltip plugin ---

export function configureFormatToolbar(ctx: Ctx) {
  const content = createToolbarElement()

  // Dispatch formatting commands on click
  content.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest('button[data-command]')
    if (!button) return
    e.preventDefault()
    const cmd = button.getAttribute('data-command')
    if (cmd) dispatchCommand(ctx, cmd)
  })

  // Prevent toolbar clicks from stealing editor focus
  content.addEventListener('mousedown', (e) => {
    e.preventDefault()
  })

  ctx.set(formatToolbar.key, {
    view: (_view: EditorView) => {
      const provider = new TooltipProvider({
        content,
        debounce: 100,
        offset: { mainAxis: 8, crossAxis: 0 },
      })

      return {
        update: (updatedView: EditorView, prevState: Parameters<typeof provider.update>[1]) => {
          provider.update(updatedView, prevState)
          updateActiveStates(content, updatedView)
        },
        destroy: () => {
          provider.destroy()
          content.remove()
        },
      }
    },
  })
}
