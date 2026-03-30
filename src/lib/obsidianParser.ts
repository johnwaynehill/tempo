/**
 * Parses Obsidian vault markdown files into Tempo notes.
 *
 * Handles:
 * - YAML frontmatter stripping
 * - [[wikilinks]] → standard markdown links
 * - ![[embeds]] → plain text references
 * - Filename → note title (without .md extension)
 */

export interface ParsedObsidianNote {
  title: string
  content: string
}

/** Strip YAML frontmatter delimited by --- */
function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text
  const end = text.indexOf('---', 3)
  if (end === -1) return text
  return text.slice(end + 3).trimStart()
}

/** Convert [[wikilinks]] and ![[embeds]] to standard markdown */
function convertWikilinks(text: string): string {
  // ![[embed]] → _(embed)_
  text = text.replace(/!\[\[([^\]]+)\]\]/g, '_($1)_')
  // [[link|display]] → display
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  // [[link]] → link
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1')
  return text
}

/** Derive a title from the filename (strip .md, path separators) */
function titleFromFilename(filename: string): string {
  // Take the last path segment and drop .md
  const base = filename.split('/').pop() ?? filename
  return base.replace(/\.md$/i, '')
}

/** Parse a single Obsidian .md file into a Tempo-ready note */
export function parseObsidianFile(
  filename: string,
  raw: string,
): ParsedObsidianNote {
  const content = convertWikilinks(stripFrontmatter(raw))
  return {
    title: titleFromFilename(filename),
    content: content.trim(),
  }
}
