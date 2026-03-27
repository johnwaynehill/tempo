import { useState, useMemo } from 'react'
import { parseCSV } from '@/lib/csv'
import { autoMapHeader, mapRow, summarizeImport, type CodaMappedTodo } from '@/lib/codaMapper'
import { useTodos } from '@/hooks/useTodos'

interface CodaImportModalProps {
  onClose: () => void
}

type Step = 'upload' | 'map' | 'preview' | 'importing' | 'done'

const TEMPO_FIELDS = [
  { value: '', label: '— Skip —' },
  { value: 'title', label: 'Title' },
  { value: 'project', label: 'Project' },
  { value: 'status', label: 'Status' },
  { value: 'progress', label: 'Progress' },
  { value: 'size', label: 'Size' },
  { value: 'impact', label: 'Impact' },
  { value: 'energy_level', label: 'Energy Level' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'supports', label: 'Supports' },
]

export function CodaImportModal({ onClose }: CodaImportModalProps) {
  const { addTodo, updateTodo } = useTodos()

  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<Record<string, string>>({})
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Parse the uploaded file
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    try {
      const text = await file.text()
      const parsed = parseCSV(text)

      if (parsed.length === 0) {
        setError('No data rows found in the CSV file.')
        return
      }

      const csvHeaders = Object.keys(parsed[0])
      setHeaders(csvHeaders)
      setRows(parsed)

      // Auto-map headers
      const mapping: Record<string, string> = {}
      for (const h of csvHeaders) {
        mapping[h] = autoMapHeader(h) ?? ''
      }
      setColumnMap(mapping)

      setStep('map')
    } catch {
      setError('Could not parse the CSV file. Make sure it is a valid CSV export from Coda.')
    }
  }

  // Map all rows using current column mapping
  const mappedItems = useMemo(() => {
    if (rows.length === 0) return []
    return rows
      .map((row) => mapRow(row, columnMap))
      .filter((item): item is CodaMappedTodo => item !== null)
  }, [rows, columnMap])

  const summary = useMemo(() => summarizeImport(mappedItems), [mappedItems])

  const hasTitleMapped = Object.values(columnMap).includes('title')

  // Batch import
  const handleImport = async () => {
    setStep('importing')
    setImportedCount(0)

    for (const item of mappedItems) {
      const id = await addTodo({
        title: item.title,
        status: item._status,
        project: item.project,
        size: item.size,
        impact: item.impact,
        energy_level: item.energy_level,
        due_date: item.due_date,
      })

      // Set additional fields not in AddTodoInput
      const extras: Record<string, unknown> = {}
      if (item._progress !== undefined) extras.progress = item._progress
      if (item._supports) extras.supports = item._supports
      if (Object.keys(extras).length > 0) {
        await updateTodo(id, extras)
      }

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
            {step === 'upload' && 'Import from Coda'}
            {step === 'map' && 'Map Columns'}
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
                Export your Coda table as CSV, then upload it here. Tempo will auto-map columns and let you review before importing.
              </p>
              <label className="block w-full cursor-pointer">
                <div className="border-2 border-dashed border-outline-variant/40 rounded-xl p-8 text-center hover:border-primary/40 transition-colors duration-200">
                  <p className="text-on-surface text-sm font-medium mb-1">Choose CSV file</p>
                  <p className="text-on-surface-variant text-xs">or drag and drop</p>
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              {error && (
                <p className="text-error text-xs mt-3">{error}</p>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'map' && (
            <div>
              <p className="text-on-surface-variant text-sm mb-4">
                We auto-mapped what we could. Adjust any columns that look wrong, or skip ones you don't need.
              </p>
              <div className="space-y-2.5 mb-6">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-on-surface text-sm font-medium w-1/3 truncate" title={h}>
                      {h}
                    </span>
                    <span className="text-on-surface-variant text-xs">&rarr;</span>
                    <select
                      value={columnMap[h] ?? ''}
                      onChange={(e) => setColumnMap({ ...columnMap, [h]: e.target.value })}
                      className="flex-1 text-sm bg-surface-container rounded-lg px-3 py-1.5 text-on-surface border-none outline-none cursor-pointer"
                    >
                      {TEMPO_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {!hasTitleMapped && (
                <p className="text-error text-xs mb-3">
                  Map at least one column to "Title" to continue.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('preview')}
                  disabled={!hasTitleMapped}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium disabled:opacity-40 cursor-pointer"
                >
                  Preview ({mappedItems.length} items)
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              <p className="text-on-surface-variant text-sm mb-4">
                Ready to import {summary.total} todos into Tempo.
              </p>

              <div className="bg-surface-container rounded-xl p-4 space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Backlog</span>
                  <span className="text-on-surface font-medium">{summary.backlog}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Done</span>
                  <span className="text-on-surface font-medium">{summary.done}</span>
                </div>
                <div className="border-t border-outline-variant/20 pt-2 mt-2 flex justify-between text-sm">
                  <span className="text-on-surface-variant">With project</span>
                  <span className="text-on-surface font-medium">{summary.withProject}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">With due date</span>
                  <span className="text-on-surface font-medium">{summary.withDueDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">With energy level</span>
                  <span className="text-on-surface font-medium">{summary.withEnergy}</span>
                </div>
              </div>

              {/* Sample rows */}
              <p className="text-on-surface-variant text-xs mb-2 font-medium">Sample rows:</p>
              <div className="space-y-1.5 mb-6 max-h-40 overflow-y-auto">
                {mappedItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="bg-surface-container rounded-lg px-3 py-2">
                    <p className="text-on-surface text-sm truncate">{item.title}</p>
                    <p className="text-on-surface-variant text-xs">
                      {[
                        item._status,
                        item.project,
                        item.size,
                        item.energy_level,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                ))}
                {mappedItems.length > 5 && (
                  <p className="text-on-surface-variant text-xs text-center">
                    ...and {mappedItems.length - 5} more
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('map')}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-br from-primary to-primary-dim text-on-primary text-sm font-medium cursor-pointer"
                >
                  Import {summary.total} todos
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="text-center py-6">
              <p className="text-on-surface text-sm mb-3">
                Importing {importedCount} of {mappedItems.length}...
              </p>
              <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${(importedCount / mappedItems.length) * 100}%` }}
                />
              </div>
              <p className="text-on-surface-variant text-xs mt-3">
                Don't close this window
              </p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="text-center py-6">
              <p className="text-3xl mb-3">&#10003;</p>
              <p className="text-on-surface text-sm font-medium mb-1">
                {importedCount} todos imported
              </p>
              <p className="text-on-surface-variant text-xs mb-6">
                Open Backlog to see your imported items. The Today algorithm will surface the best candidates.
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
