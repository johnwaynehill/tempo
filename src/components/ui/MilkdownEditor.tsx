import { useRef, useCallback, useEffect } from 'react'
import { MilkdownProvider, Milkdown, useEditor, useInstance } from '@milkdown/react'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { history } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { clipboard } from '@milkdown/kit/plugin/clipboard'
import { indent } from '@milkdown/kit/plugin/indent'
import { trailing } from '@milkdown/kit/plugin/trailing'
import { extendListItemSchemaForTask, wrapInTaskListInputRule } from '@milkdown/kit/preset/gfm'
import { remarkGFMPlugin } from '@milkdown/kit/preset/gfm'
import { formatToolbar, configureFormatToolbar } from '@/lib/milkdown-toolbar-plugin'
import { hashtagPlugin } from '@/lib/milkdown-hashtag-plugin'
import { MobileFormatBar } from '@/components/ui/MobileFormatBar'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'

interface MilkdownEditorProps {
  defaultValue: string
  onChange: (markdown: string) => void
  onCheckboxToggle?: (text: string, checked: boolean) => void
}

function MilkdownInner({ defaultValue, onChange, onCheckboxToggle }: MilkdownEditorProps) {
  const onCheckboxToggleRef = useRef(onCheckboxToggle)
  onCheckboxToggleRef.current = onCheckboxToggle

  useEditor((root) => {
    return Editor.make()
      .config(nord)
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, defaultValue)
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          onChange(markdown)
        })
      })
      .config(configureFormatToolbar)
      .use(remarkGFMPlugin)
      .use(commonmark)
      .use(extendListItemSchemaForTask)
      .use(wrapInTaskListInputRule)
      .use(history)
      .use(listener)
      .use(clipboard)
      .use(indent)
      .use(trailing)
      .use(formatToolbar)
      .use(hashtagPlugin)
  }, [])

  // Attach click handler for task list checkboxes
  const [loading, getInstance] = useInstance()

  const handleClick = useCallback((e: MouseEvent) => {
    if (loading) return
    const target = e.target as HTMLElement

    // Check if we clicked on a task list item
    const li = target.closest('li[data-item-type="task"]') as HTMLElement | null
    if (!li) return

    // Only toggle if clicked near the checkbox area (left 28px)
    const rect = li.getBoundingClientRect()
    if (e.clientX - rect.left > 28) return

    e.preventDefault()
    e.stopPropagation()

    const editor = getInstance()
    if (!editor) return

    const view = editor.ctx.get(editorViewCtx)
    const { state } = view

    // Find the position of this list item in the document
    const pos = view.posAtDOM(li, 0)
    const resolvedPos = state.doc.resolve(pos)

    // Walk up to find the list_item node
    let depth = resolvedPos.depth
    while (depth >= 0 && resolvedPos.node(depth).type.name !== 'list_item') {
      depth--
    }

    if (depth < 0) return

    const node = resolvedPos.node(depth)
    if (node.attrs.checked == null) return

    const newChecked = !node.attrs.checked
    const nodePos = resolvedPos.before(depth)

    // Dispatch the transaction
    const tr = state.tr.setNodeMarkup(nodePos, undefined, {
      ...node.attrs,
      checked: newChecked,
    })
    view.dispatch(tr)

    // Extract text content for sync callback
    const textContent = node.textContent.trim()
    onCheckboxToggleRef.current?.(textContent, newChecked)
  }, [loading, getInstance])

  useEffect(() => {
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [handleClick])

  return <Milkdown />
}

export function MilkdownEditor({ defaultValue, onChange, onCheckboxToggle }: MilkdownEditorProps) {
  return (
    <MilkdownProvider>
      <div className="milkdown-editor-root">
        <MilkdownInner defaultValue={defaultValue} onChange={onChange} onCheckboxToggle={onCheckboxToggle} />
      </div>
      <MobileFormatBar />

      {/* Strip Nord's container chrome so the editor is invisible — just text on the page */}
      <style>{`
        .milkdown-editor-root .milkdown {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          outline: none;
        }
        .milkdown-editor-root .editor,
        .milkdown-editor-root .ProseMirror {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          outline: none;
          min-height: 40vh;
          font-size: 15px;
          line-height: 1.7;
        }
        .milkdown-editor-root .ProseMirror h1 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-on-surface);
          margin-bottom: 0.75rem;
          margin-top: 1.5rem;
        }
        .milkdown-editor-root .ProseMirror h2 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-on-surface);
          margin-bottom: 0.5rem;
          margin-top: 1.25rem;
        }
        .milkdown-editor-root .ProseMirror h3 {
          font-family: var(--font-display, 'Manrope', sans-serif);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-on-surface);
          margin-bottom: 0.5rem;
          margin-top: 1rem;
        }
        .milkdown-editor-root .ProseMirror p {
          color: var(--color-on-surface);
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror a {
          color: var(--color-primary);
          text-decoration: none;
        }
        .milkdown-editor-root .ProseMirror a:hover {
          text-decoration: underline;
        }
        .milkdown-editor-root .ProseMirror code {
          background: var(--color-surface-container-high);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 0.8em;
        }
        .milkdown-editor-root .ProseMirror pre {
          background: var(--color-surface-container-high);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 0.75rem;
          overflow-x: auto;
        }
        .milkdown-editor-root .ProseMirror blockquote {
          border-left: 2px solid var(--color-outline-variant);
          padding-left: 1rem;
          color: var(--color-on-surface-variant);
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .milkdown-editor-root .ProseMirror li {
          color: var(--color-on-surface);
          margin-bottom: 0.25rem;
        }
        .milkdown-editor-root .ProseMirror li[data-item-type="task"] {
          list-style: none;
          position: relative;
          margin-left: -1.5rem;
          padding-left: 1.75rem;
        }
        .milkdown-editor-root .ProseMirror li[data-item-type="task"]::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.35em;
          width: 1.1rem;
          height: 1.1rem;
          border: 2px solid var(--color-outline-variant);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .milkdown-editor-root .ProseMirror li[data-item-type="task"][data-checked="true"]::before {
          background: var(--color-primary);
          border-color: var(--color-primary);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M2.5 6L5 8.5L9.5 3.5'/%3E%3C/svg%3E");
          background-size: 10px;
          background-repeat: no-repeat;
          background-position: center;
        }
        .milkdown-editor-root .ProseMirror li[data-item-type="task"][data-checked="true"] > p {
          text-decoration: line-through;
          color: var(--color-on-surface-variant);
          opacity: 0.6;
        }
        .milkdown-editor-root .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--color-outline-variant);
          margin: 1.5rem 0;
        }
        .milkdown-editor-root .ProseMirror p.is-editor-empty:first-child::before {
          content: 'Start writing...';
          color: var(--color-on-surface-variant);
          opacity: 0.4;
          float: left;
          pointer-events: none;
          height: 0;
        }
        .milkdown-editor-root .ProseMirror .hashtag-badge {
          background: var(--color-primary-container, rgba(0,0,0,0.06));
          color: var(--color-on-primary-container, var(--color-primary));
          padding: 1px 6px;
          border-radius: 6px;
          font-size: 0.9em;
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>
    </MilkdownProvider>
  )
}
