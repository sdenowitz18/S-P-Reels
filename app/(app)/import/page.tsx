'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

interface ParsedFilm { title: string; year: number | null; stars: number | null }

type Phase = 'upload' | 'preview' | 'importing' | 'done'

const CHUNK = 15 // films per batch

export default function ImportPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('upload')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [films, setFilms] = useState<ParsedFilm[]>([])

  // brief generation
  const [briefsRunning, setBriefsRunning] = useState(false)
  const [briefsDone, setBriefsDone] = useState(false)
  const [briefsGenerated, setBriefsGenerated] = useState(0)

  // import progress
  const [imported, setImported] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [notFound, setNotFound] = useState(0)
  const [failed, setFailed] = useState(0)
  const [notFoundTitles, setNotFoundTitles] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [processed, setProcessed] = useState(0)

  const handleFile = async (file: File) => {
    setParsing(true)
    setParseError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/import/letterboxd/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'parse failed')
      setFilms(data.films)
      setPhase('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'something went wrong')
    } finally {
      setParsing(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const startImport = async () => {
    setPhase('importing')
    setTotal(films.length)
    setProcessed(0)
    setImported(0)
    setSkipped(0)
    setNotFound(0)
    setFailed(0)
    setNotFoundTitles([])

    const chunks: ParsedFilm[][] = []
    for (let i = 0; i < films.length; i += CHUNK) {
      chunks.push(films.slice(i, i + CHUNK))
    }

    for (const chunk of chunks) {
      try {
        const res = await fetch('/api/import/letterboxd', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ films: chunk }),
        })
        const data = await res.json()
        setImported(prev => prev + (data.imported ?? 0))
        setSkipped(prev => prev + (data.skipped ?? 0))
        setNotFound(prev => prev + (data.notFound ?? 0))
        setFailed(prev => prev + (data.failed ?? 0))
        setNotFoundTitles(prev => [...prev, ...(data.notFoundTitles ?? [])])
      } catch {
        setFailed(prev => prev + chunk.length)
      }
      setProcessed(prev => prev + chunk.length)
    }

    setPhase('done')
  }

  const generateBriefs = async () => {
    setBriefsRunning(true)
    try {
      const res = await fetch('/api/import/generate-briefs', { method: 'POST' })
      const data = await res.json()
      setBriefsGenerated(data.generated ?? 0)
      setBriefsDone(true)
    } catch {
      setBriefsDone(true)
    } finally {
      setBriefsRunning(false)
    }
  }

  const rated = films.filter(f => f.stars != null)
  const unrated = films.filter(f => f.stars == null)

  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 64px', maxWidth: 720, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ IMPORT</div>
        <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1, marginBottom: 8 }}>
          import from <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>letterboxd</span>.
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', margin: '0 0 40px', lineHeight: 1.55 }}>
          upload your letterboxd data export zip. we'll import your watched films and ratings — won't overwrite anything you've already rated here.
        </p>

        {/* Upload phase */}
        {phase === 'upload' && (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              style={{
                border: '1.5px dashed var(--paper-edge)',
                borderRadius: 14, padding: '48px 32px',
                textAlign: 'center', cursor: 'pointer',
                background: 'var(--paper-2)',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bone)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--paper-2)')}
            >
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
                {parsing ? 'reading file…' : 'drop your export here'}
              </div>
              <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', margin: 0 }}>
                accepts the full .zip export or just ratings.csv
              </p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {parseError && (
              <p style={{ marginTop: 16, fontStyle: 'italic', fontSize: 13, color: '#c0392b', fontFamily: 'var(--serif-italic)' }}>
                {parseError}
              </p>
            )}
            <p style={{ marginTop: 24, fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--mono)', letterSpacing: '0.05em' }}>
              TO EXPORT FROM LETTERBOXD: settings → import &amp; export → export your data
            </p>
          </div>
        )}

        {/* Preview phase */}
        {phase === 'preview' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { label: 'total films', value: films.length },
                { label: 'with ratings', value: rated.length },
                { label: 'without ratings', value: unrated.length },
              ].map(stat => (
                <div key={stat.label} style={{ padding: '16px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, textAlign: 'center', minWidth: 110 }}>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 500 }}>{stat.value}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Sample preview */}
            <div style={{ marginBottom: 28 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>SAMPLE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '0.5px solid var(--paper-edge)', borderRadius: 10, overflow: 'hidden' }}>
                {films.slice(0, 6).map((f, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px',
                    borderBottom: i < 5 ? '0.5px solid var(--paper-edge)' : 'none',
                    background: i % 2 === 0 ? 'var(--paper)' : 'var(--paper-2)',
                  }}>
                    <div>
                      <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{f.title}</span>
                      {f.year && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', marginLeft: 8 }}>{f.year}</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: f.stars ? 'var(--s-ink)' : 'var(--ink-4)' }}>
                      {f.stars ? `${f.stars}★` : '—'}
                    </div>
                  </div>
                ))}
                {films.length > 6 && (
                  <div style={{ padding: '10px 16px', background: 'var(--bone)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                    + {films.length - 6} more films
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={startImport} className="btn" style={{ padding: '12px 24px', fontSize: 14, borderRadius: 999 }}>
                import {films.length} films →
              </button>
              <button onClick={() => setPhase('upload')} className="btn btn-soft" style={{ padding: '12px 18px', fontSize: 13, borderRadius: 999 }}>
                ← back
              </button>
            </div>
          </div>
        )}

        {/* Importing phase */}
        {phase === 'importing' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                  IMPORTING…
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {processed} / {total}
                </span>
              </div>
              <div style={{ height: 4, background: 'var(--paper-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: total > 0 ? `${(processed / total) * 100}%` : '0%',
                  background: 'var(--forest)',
                  borderRadius: 2,
                  transition: 'width 300ms ease',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'imported', value: imported, color: 'var(--forest)' },
                { label: 'already rated', value: skipped, color: 'var(--ink-3)' },
                { label: 'not found', value: notFound, color: 'var(--sun)' },
              ].map(s => (
                <div key={s.label} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: s.color, letterSpacing: '0.05em' }}>
                  {s.value} {s.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done phase */}
        {phase === 'done' && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 28, fontWeight: 500, marginBottom: 20 }}>
                done.
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                {[
                  { label: 'imported', value: imported, color: 'var(--forest)' },
                  { label: 'already in sp-reels', value: skipped, color: 'var(--ink-3)' },
                  { label: 'not matched on TMDB', value: notFound, color: 'var(--sun)' },
                  ...(failed > 0 ? [{ label: 'errors', value: failed, color: '#c0392b' }] : []),
                ].map(s => (
                  <div key={s.label} style={{ padding: '14px 20px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 24, fontWeight: 500, color: s.color }}>{s.value}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {notFoundTitles.length > 0 && (
                <details style={{ marginBottom: 24 }}>
                  <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                    {notFoundTitles.length} FILMS NOT FOUND ON TMDB
                  </summary>
                  <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--bone)', borderRadius: 8, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-3)', lineHeight: 1.8 }}>
                    {notFoundTitles.map((t, i) => <div key={i}>{t}</div>)}
                  </div>
                </details>
              )}
            </div>

            {/* Brief generation */}
            {!briefsDone && (
              <div style={{ marginBottom: 24, padding: '18px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                  build your taste profile
                </div>
                <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>
                  generate ai briefs for your imported films — this powers your radar chart, genre breakdown, and film signature. takes a few minutes.
                </p>
                <button
                  onClick={generateBriefs}
                  disabled={briefsRunning}
                  className="btn"
                  style={{ padding: '10px 20px', fontSize: 13, borderRadius: 999, opacity: briefsRunning ? 0.6 : 1 }}
                >
                  {briefsRunning ? 'generating… (this takes a few minutes)' : 'generate taste profile →'}
                </button>
              </div>
            )}

            {briefsDone && (
              <div style={{ marginBottom: 24, padding: '14px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--forest)', letterSpacing: '0.06em' }}>
                  ✓ {briefsGenerated} briefs generated — your taste profile is ready
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => router.push('/movies')} className="btn" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
                see your films →
              </button>
              <button onClick={() => router.push('/profile')} className="btn btn-soft" style={{ padding: '12px 18px', fontSize: 13, borderRadius: 999 }}>
                view taste profile
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
