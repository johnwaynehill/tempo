/**
 * Simple CSV parser that handles quoted fields with commas and newlines.
 * Returns an array of objects keyed by the header row.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows = parseRows(text)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').trim()
    })
    return obj
  })
}

/** Parse CSV text into a 2D array of strings, handling quoted fields. */
function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"'
        i++ // skip escaped quote
      } else if (c === '"') {
        inQuotes = false
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        row.push(field)
        field = ''
      } else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(field)
        field = ''
        if (row.some((f) => f.trim())) rows.push(row)
        row = []
        if (c === '\r') i++ // skip \n after \r
      } else {
        field += c
      }
    }
  }

  // Last field/row
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)

  return rows
}
