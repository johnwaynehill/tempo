/**
 * Extract hashtag-based project names from markdown content.
 * Matches #ProjectName and \#ProjectName (Milkdown escapes # at line start).
 * Also supports #[Multi Word Project] syntax.
 * Ignores markdown headings and code blocks.
 */

// Matches: #Tag or \#Tag (escaped by Milkdown), single word or bracketed
const HASHTAG_RE = /(?:^|[\s(])\\?#(\w[\w-]*)(?=[\s.,;:!?)}\]]|$)|(?:^|[\s(])\\?#\[([^\]]+)\]/gm

export function extractHashtags(markdown: string): string[] {
  const tags: string[] = []
  // Strip code blocks and inline code to avoid matching inside them
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')

  let match: RegExpExecArray | null
  while ((match = HASHTAG_RE.exec(stripped)) !== null) {
    const tag = (match[1] ?? match[2])?.trim()
    if (tag && !tags.includes(tag)) {
      tags.push(tag)
    }
  }

  return tags
}
