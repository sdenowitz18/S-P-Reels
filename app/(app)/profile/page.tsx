'use client'
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { RadarChart, AXIS_INFO, AXES } from '@/components/radar-chart'
import { DimBar } from '@/components/dim-bar'
import { FilmDetailPanel } from '@/components/film-detail-panel'
import { TasteDimensions } from '@/lib/prompts/taste-profile'
import { LibraryEntry } from '@/lib/types'

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null }
interface SignatureFilm { film_id: string; title: string; poster_path: string | null; stars: number }
interface TopFilm { film_id: string; title: string; poster_path: string | null; year: number | null; director: string | null; stars: number }
interface DirectorEntry { name: string; count: number; avgRating: number | null }
interface ActorEntry { name: string; count: number; avgRating: number | null }
interface DecadeEntry { decade: number; count: number; avgRating: number | null }
interface LibraryFilm {
  entry_id: string; film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}

type CategoryType = 'director' | 'actor' | 'genre' | 'decade'
interface SelectedCategory { type: CategoryType; label: string; avgRating: number | null; count: number }

interface TasteProfile {
  dimensions: TasteDimensions
  genres: GenreEntry[]
  signature: SignatureFilm[]
  topRated: TopFilm[]
  prose: string | null
  directors: DirectorEntry[]
  actors: ActorEntry[]
  decades: DecadeEntry[]
  libraryFilms: LibraryFilm[]
  filmCount: number
  ratedCount: number
}


function RankedList({ items, getLabel, onSelect }: {
  items: { name?: string; decade?: number; count: number; avgRating: number | null }[]
  getLabel: (item: { name?: string; decade?: number; count: number; avgRating: number | null }) => string
  onSelect: (label: string, avgRating: number | null, count: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map((item, i) => (
          <button
            key={i}
            onClick={() => onSelect(getLabel(item), item.avgRating, item.count)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0',
              background: 'none', border: 'none', borderBottom: '0.5px solid var(--paper-edge)',
              cursor: 'pointer', textAlign: 'left', width: '100%',
              transition: 'opacity 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', width: 14, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getLabel(item)}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em', flexShrink: 0 }}>
              {item.count}×
            </div>
            {item.avgRating != null && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                {item.avgRating.toFixed(1)}★
              </div>
            )}
          </button>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)',
            letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
          }}
        >
          {expanded ? 'show less ↑' : `show ${items.length - 5} more ↓`}
        </button>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingBriefs, setGeneratingBriefs] = useState(false)
  const [briefsDone, setBriefsDone] = useState(false)
  const [selectedDim, setSelectedDim] = useState<keyof TasteDimensions | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)
  const [detailEntry, setDetailEntry] = useState<LibraryEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const panelFilms = useMemo(() => {
    if (!selectedCategory || !taste?.libraryFilms) return []
    const { type, label } = selectedCategory
    return taste.libraryFilms
      .filter(f => {
        if (type === 'director') return f.director === label
        if (type === 'actor') return f.cast.includes(label)
        if (type === 'genre') return f.genres.includes(label)
        if (type === 'decade') return f.year != null && Math.floor(f.year / 10) * 10 === parseInt(label)
        return false
      })
      .sort((a, b) => (b.my_stars ?? -1) - (a.my_stars ?? -1))
  }, [selectedCategory, taste?.libraryFilms])

  function openCategory(type: CategoryType) {
    return (label: string, avgRating: number | null, count: number) =>
      setSelectedCategory({ type, label, avgRating, count })
  }

  async function openFilmDetail(entryId: string) {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/library/${entryId}`)
      if (res.ok) {
        const data = await res.json()
        setDetailEntry(data as LibraryEntry)
      }
    } catch {}
    setDetailLoading(false)
  }

  function handleDetailUpdate(updated: LibraryEntry) {
    setDetailEntry(updated)
    // Reflect star change in local libraryFilms so the panel list stays in sync
    setTaste(prev => {
      if (!prev) return prev
      return {
        ...prev,
        libraryFilms: prev.libraryFilms.map(f =>
          f.entry_id === updated.id ? { ...f, my_stars: updated.my_stars } : f
        ),
      }
    })
  }

  function handleDetailRemove(entryId: string) {
    setDetailEntry(null)
    setTaste(prev => {
      if (!prev) return prev
      return { ...prev, libraryFilms: prev.libraryFilms.filter(f => f.entry_id !== entryId) }
    })
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/profile/taste').then(r => r.json()),
    ]).then(([p, t]) => {
      setProfile(p)
      setTaste(t)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const hasEnoughData = (taste?.ratedCount ?? 0) >= 5

  const generateBriefs = async () => {
    setGeneratingBriefs(true)
    await fetch('/api/import/generate-briefs', { method: 'POST' })
    setBriefsDone(true)
    setGeneratingBriefs(false)
    const t = await fetch('/api/profile/taste').then(r => r.json())
    setTaste(t)
  }

  const hasNumbers = taste && (
    taste.genres.length > 0 || taste.directors.length > 0 ||
    taste.actors.length > 0 || taste.decades.length > 0
  )

  return (
    <AppShell>
      <div style={{ padding: '56px 64px 100px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ YOUR PROFILE</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
              {profile?.name
                ? <>{profile.name.split(' ')[0]}'s <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>taste</span>.</>
                : <>your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>taste</span>.</>
              }
            </h1>
            {!loading && taste && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', paddingBottom: 8 }}>
                {taste.filmCount} FILM{taste.filmCount !== 1 ? 'S' : ''} LOGGED
              </div>
            )}
          </div>
        </div>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {!loading && taste && (
          <>
            {!hasEnoughData && (
              <div style={{ marginBottom: 48, padding: '20px 24px', background: 'var(--bone)', borderRadius: 12, border: '0.5px solid var(--paper-edge)', maxWidth: 520 }}>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', lineHeight: 1.6 }}>
                  log a few more films and your taste profile will start to take shape. we need at least 5 rated films to read you properly.
                </p>
              </div>
            )}

            {/* ── SECTION 1: Taste Shape — radar + prose side by side ─────── */}
            {hasEnoughData && (
              <div style={{ marginBottom: 64 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 20 }}>★ YOUR TASTE</div>
                <div style={{ display: 'flex', gap: 56, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ flex: '0 0 auto' }}>
                    <RadarChart
                      dimensions={taste.dimensions}
                      selectedDim={selectedDim}
                      onSelectDim={setSelectedDim}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    {selectedDim ? (() => {
                      const info = AXIS_INFO[selectedDim]
                      const ax   = AXES.find(a => a.key === selectedDim)!
                      const val  = taste.dimensions[selectedDim]
                      return (
                        <div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--s-ink)', marginBottom: 2, textTransform: 'uppercase' }}>
                            {info.title}
                          </div>
                          <DimBar
                            neg={ax.neg}
                            pos={ax.pos}
                            myVal={val}
                            myColor="var(--s-ink)"
                          />
                          <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                            {info.describe(val)}
                          </p>
                          <button
                            onClick={() => setSelectedDim(null)}
                            style={{
                              marginTop: 16, background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)',
                              letterSpacing: '0.06em', padding: 0, textDecoration: 'underline',
                              textUnderlineOffset: 3,
                            }}
                          >
                            ← back to overview
                          </button>
                        </div>
                      )
                    })() : (
                      <>
                        {taste.prose && (
                          <p style={{
                            fontFamily: 'var(--serif-display)', fontSize: 20, lineHeight: 1.6,
                            fontWeight: 400, color: 'var(--ink)', margin: '0 0 20px', fontStyle: 'italic',
                          }}>
                            {taste.prose}
                          </p>
                        )}
                        <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                          click any label on the chart to explore that dimension.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── SECTION 2: Film Signature ───────────────────────────────── */}
            {taste.signature.length > 0 && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>★ FILM SIGNATURE</div>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: '0 0 18px' }}>
                  the films that most define your taste profile
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {taste.signature.map(f => (
                    <div key={f.film_id} style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 80, height: 120, borderRadius: 5, overflow: 'hidden',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                        position: 'relative', marginBottom: 6,
                      }}>
                        {f.poster_path
                          ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>
                        }
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
                        {f.stars}★
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 3: By the Numbers ───────────────────────────────── */}
            {hasNumbers && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 36 }}>★ BY THE NUMBERS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '48px 56px' }}>

                  {taste.genres.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE GENRES</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.genres.map(g => ({ name: g.label, count: g.count, avgRating: g.avgRating }))} getLabel={g => g.name ?? ''} onSelect={openCategory('genre')} />
                    </div>
                  )}

                  {taste.directors.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE DIRECTORS</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.directors} getLabel={d => d.name ?? ''} onSelect={openCategory('director')} />
                    </div>
                  )}

                  {taste.actors.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE ACTORS</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.actors} getLabel={a => a.name ?? ''} onSelect={openCategory('actor')} />
                    </div>
                  )}

                  {taste.decades.length > 0 && (
                    <div>
                      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 3 }}>FAVORITE DECADES</div>
                      <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                        by avg rating · min 3 films
                      </p>
                      <RankedList items={taste.decades.map(d => ({ name: `${d.decade}s`, count: d.count, avgRating: d.avgRating }))} getLabel={d => d.name ?? ''} onSelect={openCategory('decade')} />
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* ── SECTION 4: Top Rated ────────────────────────────────────── */}
            {taste.topRated.length > 0 && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>★ TOP RATED</div>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: '0 0 18px' }}>
                  your highest-rated films
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {taste.topRated.map(f => {
                    const lf = taste.libraryFilms.find(x => x.film_id === f.film_id)
                    return (
                      <button
                        key={f.film_id}
                        onClick={() => lf && openFilmDetail(lf.entry_id)}
                        disabled={!lf || detailLoading}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: lf ? 'pointer' : 'default', textAlign: 'center' }}
                      >
                        <div style={{
                          width: 80, height: 120, borderRadius: 5, overflow: 'hidden',
                          background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                          position: 'relative', marginBottom: 6, transition: 'opacity 120ms',
                        }}
                          onMouseEnter={e => lf && ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                        >
                          {f.poster_path
                            ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 8, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>
                          }
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 2 }}>{f.year}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--s-ink)', letterSpacing: '0.04em' }}>
                          {f.stars.toFixed(1)}★
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── BOTTOM: Generate briefs nudge ───────────────────────────── */}
            {!briefsDone && (taste.filmCount ?? 0) > (taste.ratedCount ?? 0) + 2 && (
              <div style={{ padding: '18px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, maxWidth: 520 }}>
                <p style={{ margin: '0 0 12px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>
                  some of your films are missing ai briefs — generate them to sharpen your radar chart and genre breakdown.
                </p>
                <button onClick={generateBriefs} disabled={generatingBriefs} className="btn"
                  style={{ padding: '9px 18px', fontSize: 12, borderRadius: 999, opacity: generatingBriefs ? 0.6 : 1 }}>
                  {generatingBriefs ? 'generating briefs… (a few minutes)' : 'generate missing briefs →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* ── Film Detail Panel (opens over category panel) ─────────────────── */}
      {detailEntry && (
        <FilmDetailPanel
          entry={detailEntry}
          list={detailEntry.list}
          onClose={() => setDetailEntry(null)}
          onUpdate={handleDetailUpdate}
          onRemove={() => handleDetailRemove(detailEntry.id)}
        />
      )}

      {/* ── Category Detail Panel ──────────────────────────────────────────── */}
      {selectedCategory && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedCategory(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: 'var(--paper)', borderLeft: '0.5px solid var(--paper-edge)',
            zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          }}>
            {/* Panel header */}
            <div style={{
              padding: '28px 28px 20px',
              borderBottom: '0.5px solid var(--paper-edge)',
              position: 'sticky', top: 0, background: 'var(--paper)', zIndex: 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {selectedCategory.type === 'decade' ? 'decade' : selectedCategory.type}
                  </div>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.1, color: 'var(--ink)' }}>
                    {selectedCategory.label}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 16, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                    <span>{panelFilms.length} film{panelFilms.length !== 1 ? 's' : ''}</span>
                    {selectedCategory.avgRating != null && (
                      <span style={{ color: 'var(--s-ink)' }}>{selectedCategory.avgRating.toFixed(1)}★ avg</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    background: 'none', border: '0.5px solid var(--paper-edge)', borderRadius: '50%',
                    width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0, color: 'var(--ink-3)', fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Film list */}
            <div style={{ padding: '16px 28px 40px', flex: 1 }}>
              {panelFilms.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', marginTop: 24 }}>
                  no films found
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {panelFilms.map((f, i) => (
                    <button
                      key={f.film_id}
                      onClick={() => openFilmDetail(f.entry_id)}
                      disabled={detailLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 0', width: '100%', textAlign: 'left',
                        borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                        borderBottom: i < panelFilms.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                        background: 'none',
                        cursor: 'pointer', transition: 'opacity 120ms',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.65')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                      {/* Poster */}
                      <div style={{
                        width: 36, height: 54, borderRadius: 3, overflow: 'hidden',
                        flexShrink: 0, position: 'relative',
                        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
                      }}>
                        {f.poster_path
                          ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%' }} />
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
                          lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: 'var(--ink)',
                        }}>
                          {f.title}
                        </div>
                        <div style={{
                          fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11,
                          color: 'var(--ink-4)', marginTop: 2, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {[f.director, f.year].filter(Boolean).join(' · ')}
                        </div>
                      </div>

                      {/* Rating */}
                      {f.my_stars != null && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--s-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {f.my_stars.toFixed(1)}★
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}
