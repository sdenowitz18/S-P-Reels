'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

// ── Film strip carousel ────────────────────────────────────────────────────

function FilmStrip({ films, processed }: { films: ParsedFilm[]; processed: number }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const visible   = films.slice(0, processed)

  // Auto-scroll to the latest film as import progresses
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
  }, [processed])

  if (visible.length === 0) return null

  return (
    <div style={{ marginTop: 28 }}>
      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 10, letterSpacing: '0.10em' }}>
        FILMS FLOWING IN
      </div>
      <div
        ref={scrollRef}
        style={{
          display:   'flex',
          gap:       8,
          overflowX: 'auto',
          paddingBottom: 6,
          // hide scrollbar
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {visible.map((f, i) => (
          <div
            key={i}
            style={{
              flexShrink:    0,
              width:         108,
              padding:       '9px 11px 10px',
              background:    f.stars ? 'var(--paper-2)' : 'var(--paper)',
              border:        f.stars ? '0.5px solid var(--paper-edge)' : '0.5px dashed var(--paper-edge)',
              borderRadius:  8,
              display:       'flex',
              flexDirection: 'column',
              gap:           4,
            }}
          >
            <div style={{
              fontFamily:   'var(--serif-display)',
              fontSize:     11,
              fontWeight:   500,
              lineHeight:   1.3,
              overflow:     'hidden',
              display:      '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              color:        'var(--ink)',
            }}>
              {f.title}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)' }}>
                {f.year ?? '—'}
              </span>
              {f.stars != null && (
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--sun)' }}>
                  {f.stars}★
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ParsedFilm { title: string; year: number | null; stars: number | null }

type Phase = 'upload' | 'preview' | 'importing' | 'done'

const CHUNK = 15 // films per batch

// ── Letter slot animation ──────────────────────────────────────────────────

interface LetterState { letter: string; locked: boolean }

function LetterSlots({
  letters,
  filmCount,
  label,
}: {
  letters: LetterState[]
  filmCount: number
  label?: string
}) {
  const slots: (LetterState | null)[] = [0, 1, 2, 3].map(i => letters[i] ?? null)

  return (
    <div style={{ margin: '28px 0 20px' }}>
      {/* Slots */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
        {slots.map((slot, i) => {
          const revealed = !!slot
          return (
            <div
              key={i}
              style={{
                width: 68,
                height: 84,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: slot?.locked
                  ? '1.5px solid var(--s-ink)'
                  : revealed
                    ? '1px solid var(--paper-edge)'
                    : '1px dashed var(--paper-edge)',
                borderRadius: 10,
                background: slot?.locked
                  ? 'var(--s-tint)'
                  : revealed
                    ? 'var(--paper-2)'
                    : 'transparent',
                transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                fontFamily: 'var(--serif-display)',
                fontSize: revealed ? 40 : 28,
                fontWeight: revealed ? 500 : 300,
                color: slot?.locked
                  ? 'var(--s-ink)'
                  : revealed
                    ? 'var(--ink)'
                    : 'var(--paper-edge)',
                letterSpacing: '0.01em',
              }}
            >
              {slot ? slot.letter : '?'}
            </div>
          )
        })}
      </div>

      {/* Caption */}
      <div style={{
        textAlign: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--ink-4)',
        letterSpacing: '0.08em',
      }}>
        {filmCount > 0
          ? label ?? `${filmCount} FILMS ANALYSED`
          : 'READING YOUR HISTORY…'}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('upload')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [films, setFilms] = useState<ParsedFilm[]>([])

  // enrichment + session
  const [briefsRunning, setBriefsRunning] = useState(false)
  const [briefsDone, setBriefsDone] = useState(false)
  const [briefsGenerated, setBriefsGenerated] = useState(false)
  const [sessionStarting, setSessionStarting] = useState(false)
  const [notReady, setNotReady] = useState(false)

  // import progress
  const [imported, setImported] = useState(0)
  const [skipped, setSkipped] = useState(0)
  const [notFound, setNotFound] = useState(0)
  const [failed, setFailed] = useState(0)
  const [notFoundTitles, setNotFoundTitles] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [processed, setProcessed] = useState(0)

  // live taste preview
  const [tasteLetters, setTasteLetters] = useState<LetterState[]>([])
  const [tasteFilmCount, setTasteFilmCount] = useState(0)

  const fetchTastePreview = useCallback(async () => {
    try {
      const res = await fetch('/api/import/taste-preview')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.allLetters) && data.allLetters.length > 0) {
        setTasteLetters(data.allLetters.slice(0, 4).map((e: { letter: string; locked: boolean }) => ({
          letter: e.letter,
          locked: e.locked,
        })))
        setTasteFilmCount(data.filmCount ?? 0)
      } else if (data.filmCount > 0) {
        setTasteFilmCount(data.filmCount)
      }
    } catch { /* silent */ }
  }, [])

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
      // Refresh taste preview after each chunk
      await fetchTastePreview()
    }

    setPhase('done')
  }

  const generateBriefs = async () => {
    setBriefsRunning(true)
    try {
      await fetch('/api/import/generate-briefs', { method: 'POST' })
      setBriefsGenerated(true)
      setBriefsDone(true)
    } catch {
      setBriefsDone(true)
    } finally {
      setBriefsRunning(false)
    }
  }

  const startSession = async () => {
    setSessionStarting(true)
    try {
      const res = await fetch('/api/onboarding/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'post_import' }),
      })
      const data = await res.json()
      if (data.session_id && data.path !== 'not_ready' && data.path !== 'checkin') {
        router.push(`/onboarding/interview/${data.session_id}`)
      } else {
        setNotReady(true)
        setSessionStarting(false)
      }
    } catch {
      setSessionStarting(false)
    }
  }

  // Auto-trigger enrichment when import completes
  useEffect(() => {
    if (phase === 'done' && !briefsRunning && !briefsDone) {
      generateBriefs()
    }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // After enrichment, start the interview session
  useEffect(() => {
    if (briefsDone && !sessionStarting && !notReady) {
      startSession()
    }
  }, [briefsDone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll taste-preview while briefs are generating
  useEffect(() => {
    if (!briefsRunning) return
    const id = setInterval(fetchTastePreview, 3000)
    return () => clearInterval(id)
  }, [briefsRunning, fetchTastePreview])

  const rated = films.filter(f => f.stars != null)
  const unrated = films.filter(f => f.stars == null)

  return (
    <AppShell withAdd={false}>
      <div style={{ padding: 'clamp(28px,5vw,56px) clamp(16px,5vw,64px) clamp(96px,10vw,96px)', maxWidth: 720, margin: '0 auto' }}>
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
            {/* Live taste code preview — hero section */}
            <div style={{
              padding: '28px 24px 24px',
              background: 'var(--paper-2)',
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 14,
              marginBottom: 28,
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: 'var(--serif-italic)',
                fontStyle: 'italic',
                fontSize: 13,
                color: 'var(--ink-3)',
                marginBottom: 4,
              }}>
                your taste code is taking shape
              </div>

              <LetterSlots letters={tasteLetters} filmCount={tasteFilmCount} />
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
                  IMPORTING…
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  {processed} / {total}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--paper-2)', borderRadius: 2, overflow: 'hidden' }}>
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

            {/* Scrolling film strip */}
            <FilmStrip films={films} processed={processed} />
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

            {/* Enrichment + live taste code — auto-triggered */}
            {!notReady && (
              <div style={{
                padding: '28px 24px 24px',
                background: 'var(--paper-2)',
                border: '0.5px solid var(--paper-edge)',
                borderRadius: 14,
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--serif-italic)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--ink-3)',
                  marginBottom: 4,
                }}>
                  {!briefsDone ? 'mapping your taste across 12 dimensions…' : 'almost there…'}
                </div>

                <LetterSlots
                  letters={tasteLetters}
                  filmCount={tasteFilmCount}
                  label={!briefsDone ? undefined : 'FINALISING YOUR TASTE CODE'}
                />

                {/* Pulse indicator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: briefsDone && sessionStarting ? 'var(--forest)' : 'var(--sun)',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                    {!briefsDone
                      ? 'BUILDING YOUR TASTE PROFILE…'
                      : sessionStarting
                        ? 'STARTING YOUR INTERVIEW…'
                        : 'DONE'}
                  </div>
                </div>
              </div>
            )}

            {/* Fallback: not enough data for interview */}
            {notReady && (
              <div>
                {tasteLetters.length > 0 && (
                  <div style={{
                    padding: '20px 24px 16px',
                    background: 'var(--paper-2)',
                    border: '0.5px solid var(--paper-edge)',
                    borderRadius: 14,
                    textAlign: 'center',
                    marginBottom: 20,
                  }}>
                    <LetterSlots letters={tasteLetters} filmCount={tasteFilmCount} />
                  </div>
                )}
                <div style={{ marginBottom: 20, padding: '18px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
                    still building your library
                  </div>
                  <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>
                    we need at least 30 rated films to run your taste interview. keep logging films and we'll let you know when you're ready.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => router.push('/movies')} className="btn" style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
                    see your films →
                  </button>
                  <button onClick={() => router.push('/home')} className="btn btn-soft" style={{ padding: '12px 18px', fontSize: 13, borderRadius: 999 }}>
                    go to home
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
