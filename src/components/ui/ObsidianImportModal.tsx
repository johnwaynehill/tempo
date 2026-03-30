import { useState } from 'react'
import { parseObsidianFile, type ParsedObsidianNote } from '@/lib/obsidianParser'
import { useNotes } from '@/hooks/useNotes'

interface ObsidianImportModalProps {
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

export function ObsidianImportModal({ onClose }: ObsidianImportModalProps) {
  const { addNote } = useNotes()

  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<ParsedObsidianNote[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)

    try {
      const notes: ParsedObsidianNote[] = []

      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.md')) continue
        const text = await file.text()
        notes.push(parseObsidianFile(file.name, text))
      }

      if (notes.length === 0) {
        setError('No .md files found. Select Markdown files from your Obsidian vault.')
        return
      }

      setParsed(notes)
      setStep('preview')
    } catch {
      setError('Could not read the selected files. Please try again.')
    }
  }

  const handleImport = async () => {
    setStep('importing')
    setImportedCount(0)

    for (const note of parsed) {
      await addNote(note.title, note.content)
      setImportedCount((c) => c + 1)
    }

    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm px-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="font-display text-lg font-semibold text-on-surface">
            {step === 'upload' && 'Import from Obsidian'}
            {step === 'preview' && 'Preview Import'}
            {step === 'importing' && 'Importing...'}
            {step === 'done' && 'Import Complete'}
          </h2>
          {step !== 'importing' && (
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>

        <div className="p-5">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div>
              <p className="text-on-surface-variant text-sm mb-4">
                Select .md files from your Obsidian vault folder. Frontmatter will be stripped and wiki-links converted automatically.
              </p>
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-8 text-center hover:border-primary/40 transition-colors duration-200">
                  <p className="text-on-surface text-sm font-medium mb-1">Choose .md files</p>
                  <p className="text-on-surface-variant text-xs">Select one or more Markdown files</p>
                </div>
                <input
                  type="file"
                  accept=".md"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
              </label>
              {error && (
                <p className="text-error text-xs mt-3">{error}</p>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div>
              <p className="text-on-surface-variant text-sm mb-4">
                Ready to import {parsed.length} note{parsed.length !== 1 ? 's' : ''} into Tempo.
              </p>

              <div className="bg-surface-container rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Notes to import</span>
                  <span className="text-on-surface font-medium">{parsed.length}</span>
                </div>
              </div>

              {/* Sample notes */}
              <p className="text-on-surface-variant text-xs mb-2 font-medium">Notes:</p>
              <div className="space-y-1.5 mb-6 max-h-60 overflow-y-auto">
                {parsed.map((note, i) => (
                  <div key={i} className="bg-surface-container rounded-lg px-3 py-2">
                    <p className="text-on-surface text-sm truncate">{note.title}</p>
                    <p className="text-on-surface-variant text-xs truncate">
                      {note.content.slice(0, 80)}{note.content.length > 80 ? '...' : ''}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setParsed([]); setStep('upload') }}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium cursor-pointer"
                >
                  Import {parsed.length} note{parsed.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="text-center py-6">
              <p className="text-on-surface text-sm mb-3">
                Importing {importedCount} of {parsed.length}...
              </p>
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${(importedCount / parsed.length) * 100}%` }}
                />
              </div>
              <p className="text-on-surface-variant text-xs mt-3">
                Don't close this window
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center py-6">
              <p className="text-3xl mb-3">&#10003;</p>
              <p className="text-on-surface text-sm font-medium mb-1">
                {importedCount} note{importedCount !== 1 ? 's' : ''} imported
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                Open Notes to see your imported Obsidian notes.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
