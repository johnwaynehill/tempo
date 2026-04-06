/**
 * Extract hashtag-based project names from markdown content.
 * Matches #ProjectName tags (single word) and #[Multi Word Project] tags.
 * Ignores headings (lines starting with #) and code blocks.
 */

const HASHTAG_RE = /(?:^|[\s(])#(\w[\w-]*)(?=[\s.,;:!?)}\]]|$)|(?:^|[\s(])#\[([^\]]+)\]/gm

export function extractHashtags(markdown: string): string[] {
  const tags: string[] = []
  // Strip code blocks to avoid matching inside them
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

/**
 * Get the first hashtag as the project name, or undefined if none.
 */
export function extractProject(markdown: string): string | undefined {
  const tags = extractHashtags(markdown)
  return tags[0] ?? undefined
}
