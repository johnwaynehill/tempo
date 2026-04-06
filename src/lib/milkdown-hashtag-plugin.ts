/**
 * Milkdown plugin that visually styles #hashtags as badges in the editor.
 * Uses ProseMirror decorations to wrap matching text in styled spans.
 */
import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

const hashtagPluginKey = new PluginKey('hashtag-decoration')

// Match #Tag or \#Tag patterns (same as extractHashtags but for rendered text)
const HASHTAG_INLINE_RE = /\\?#(\w[\w-]*)/g

function findHashtags(doc: import('@milkdown/prose/model').Node): Decoration[] {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    // Skip if inside a code block or code mark
    if (node.marks.some(m => m.type.name === 'code_inline' || m.type.name === 'code')) return

    let match: RegExpExecArray | null
    HASHTAG_INLINE_RE.lastIndex = 0
    while ((match = HASHTAG_INLINE_RE.exec(node.text)) !== null) {
      const start = pos + match.index
      const end = start + match[0].length

      // Don't decorate if it looks like a markdown heading (# at start of block)
      // Check if the match is at position 0 of the text node and follows ## pattern
      if (match.index === 0 && !match[0].startsWith('\\')) {
        // Could be a heading marker — skip single # at line start without backslash
        // But our content uses \# so escaped ones are always hashtags
        continue
      }

      decorations.push(
        Decoration.inline(start, end, {
          class: 'hashtag-badge',
          nodeName: 'span',
        })
      )
    }

    return true // continue descending
  })

  return decorations
}

export const hashtagPlugin = $prose(() => {
  return new Plugin({
    key: hashtagPluginKey,
    state: {
      init(_, { doc }) {
        return DecorationSet.create(doc, findHashtags(doc))
      },
      apply(tr, old) {
        if (tr.docChanged) {
          return DecorationSet.create(tr.doc, findHashtags(tr.doc))
        }
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
})
