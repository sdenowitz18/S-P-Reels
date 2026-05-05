'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteCode } from '@/lib/taste-code'
import { poleBadgeTier } from '@/components/taste-letter'
import { LetterLoader } from '@/components/letter-loader'

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null }
interface SignatureFilm { film_id: string; title: string; poster_path: string | null; stars: number }
interface TopFilm { film_id: string; title: string; poster_path: string | null; year: number | null; director: string | null; stars: number }
interface DirectorEntry { name: string; count: number; avgRating: number | null }
interface ActorEntry { name: string; count: number; avgRating: number | null }
interface DecadeEntry { decade: number; count: number; avgRating: number | null }
interface LibraryFilm {
  film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}

type CategoryType = 'director' | 'actor' | 'genre' | 'decade'
interface SelectedCategory { type: CategoryType; label: string; avgRating: number | null; count: number }

interface TasteProfile {
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
  friendName?: string
  tasteCode?: TasteCode | null
}

const DIM_AXIS_LABEL: Record<string, string> = {
  narrative_legibility:    'Legible ← → Opaque',
  emotional_directness:    'Vivid ← → Subtle',
  plot_vs_character:       'Plot ← → Character',
  naturalistic_vs_stylized:'Naturalistic ← → Theatrical',
  narrative_closure:       'Whole ← → Questioning',
  intimate_vs_epic:        'Intimate ← → Epic',
  accessible_vs_demanding: 'Familiar ← → Demanding',
  psychological_safety:    'Hopeful ← → Unsettling',
  moral_clarity:           'Just ← → Ambiguous',
  behavioral_realism:      'Realistic ← → Archetypal',
  sensory_vs_intellectual: 'Gut ← → Mind',
  kinetic_vs_patient:      'Kinetic ← → Zen',
}

function TasteCodeDisplay({ code, prose, accentColor = 'var(--p-ink)', onViewFull }: {
  code: TasteCode; prose?: string | null; accentColor?: string; onViewFull?: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const activeEntry = expanded ? code.entries.find(e => e.letter === expanded) : null

  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 48, rowGap: 16 }}>
        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', paddingTop: 2 }}>★ TASTE CODE</div>
        <div style={{ display: 'flex', alignItems: 'center', minHeight: 18 }}>
          {activeEntry && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
              {DIM_AXIS_LABEL[activeEntry.dimKey] ?? activeEntry.dimKey}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignSelf: 'flex-start' }}>
          {code.entries.map(entry => {
            const isActive = expanded === entry.letter
            const strength = Math.round((entry.gap / 100) * 100)
            return (
              <div key={entry.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setExpanded(isActive ? null : entry.letter)}
                  style={{
                    background: isActive ? 'var(--ink)' : 'var(--paper-2)',
                    border: `0.5px solid ${isActive ? 'var(--ink)' : 'var(--paper-edge)'}`,
                    borderRadius: 10, width: 76, height: 76, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 120ms', gap: 4, padding: 0,
                  }}
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <span style={{ fontFamily: 'var(--serif-display)', fontSize: 38, fontWeight: 600, lineHeight: 1, color: isActive ? 'var(--paper)' : 'var(--ink)' }}>
                      {entry.letter}
                    </span>
                    {!isActive && (() => {
                      const tier = poleBadgeTier(entry.poleScore)
                      return (
                        <span style={{
                          position: 'absolute', top: -5, right: -8,
                          minWidth: 14, height: 14, borderRadius: 999,
                          background: tier === 'H' ? 'var(--forest, #225533)' : tier === 'M' ? 'var(--sun, #d4a847)' : 'var(--paper-edge, #ccc)',
                          color: tier === 'L' ? 'var(--ink-3)' : '#fff',
                          fontSize: 7, fontFamily: 'var(--mono)', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 2px', pointerEvents: 'none', lineHeight: 1,
                        }}>{tier}</span>
                      )
                    })()}
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.08em', textTransform: 'uppercase', color: isActive ? 'var(--paper-edge)' : 'var(--ink-4)' }}>
                    {entry.label}
                  </span>
                </button>
                <div style={{ width: 76, height: 3, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${strength}%`, height: '100%', background: isActive ? 'var(--ink)' : accentColor, borderRadius: 999, transition: 'all 120ms' }} />
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>{strength}</div>
                {entry.sampleFilms.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                    {entry.sampleFilms.slice(0, 3).map(f => (
                      <div key={f.film_id} style={{ width: 22, height: 33, borderRadius: 2, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', flexShrink: 0, opacity: isActive ? 1 : 0.65, transition: 'opacity 120ms' }}>
                        {f.poster_path && <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ alignSelf: 'flex-start' }}>
          {activeEntry ? (
            <>
              <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.65, color: 'var(--ink-2)', margin: '0 0 20px' }}>
                {activeEntry.description}
              </p>
              {activeEntry.sampleFilms.length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {activeEntry.sampleFilms.map(f => (
                    <div key={f.film_id} style={{ textAlign: 'center', width: 80 }}>
                      <div style={{ width: 80, height: 120, borderRadius: 5, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', marginBottom: 6 }}>
                        {f.poster_path ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, fontSize: 7, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>{f.title.toUpperCase()}</div>}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: accentColor }}>{f.stars.toFixed(1)}★</div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setExpanded(null)} style={{ marginTop: 16, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-4)', letterSpacing: '0.06em', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>← back</button>
            </>
          ) : (
            <>
              {prose && <p style={{ fontFamily: 'var(--serif-display)', fontSize: 19, lineHeight: 1.6, fontWeight: 400, color: 'var(--ink)', margin: '0 0 12px', fontStyle: 'italic' }}>{prose}</p>}
              <p style={{ margin: '0 0 16px', fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.5 }}>tap a letter to explore that signal.</p>
              {onViewFull && (
                <button onClick={onViewFull} style={{ background: 'none', border: '0.5px solid var(--ink-3)', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--ink-3)', letterSpacing: '0.08em', transition: 'all 120ms' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink-3)' }}>
                  VIEW FULL TASTE CODE →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
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
              borderBottom: '0.5px solid var(--paper-edge)',
              background: 'none', border: 'none',
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
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--p-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
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

export default function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friendId, setFriendId] = useState('')
  const [friendName, setFriendName] = useState('')
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null)

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

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      const res = await fetch(`/api/friends/${id}/taste`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setTaste(data)
      setFriendName(data.friendName ?? '')
      setLoading(false)
    })
  }, [params])

  const hasEnoughData = (taste?.ratedCount ?? 0) >= 5

  const hasNumbers = taste && (
    taste.genres.length > 0 || taste.directors.length > 0 ||
    taste.actors.length > 0 || taste.decades.length > 0
  )

  return (
    <AppShell active="friends">
      <div style={{ padding: '56px 64px 100px', maxWidth: 1000, margin: '0 auto' }}>

        {/* Nav row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0 }}
          >
            ← back
          </button>
          {friendId && (
            <button
              onClick={() => router.push(`/friends/${friendId}`)}
              style={{ background: 'none', border: '0.5px solid var(--paper-edge)', borderRadius: 999, padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.06em' }}
            >
              view blend →
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        )}

        {!loading && taste && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 48 }}>
              <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ THEIR PROFILE</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
                <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: 0 }}>
                  {friendName
                    ? <>{friendName.split(' ')[0]}'s <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>taste</span>.</>
                    : <>their <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>taste</span>.</>
                  }
                </h1>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', paddingBottom: 8 }}>
                  {taste.filmCount} FILM{taste.filmCount !== 1 ? 'S' : ''} LOGGED
                </div>
              </div>
            </div>

            {!hasEnoughData && (
              <div style={{ marginBottom: 48, padding: '20px 24px', background: 'var(--bone)', borderRadius: 12, border: '0.5px solid var(--paper-edge)', maxWidth: 520 }}>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', lineHeight: 1.6 }}>
                  {friendName} hasn't logged enough films yet to build a full taste profile — check back after they rate a few more.
                </p>
              </div>
            )}

            {/* ── SECTION 1: Taste Code ───────────────────────────────────── */}
            {hasEnoughData && taste.tasteCode && (
              <TasteCodeDisplay
                code={taste.tasteCode}
                prose={taste.prose}
                accentColor="var(--p-ink)"
                onViewFull={() => router.push(`/friends/${friendId}/taste-code`)}
              />
            )}

            {/* ── SECTION 2: Film Signature ───────────────────────────────── */}
            {taste.signature.length > 0 && (
              <div style={{ marginBottom: 72 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>★ FILM SIGNATURE</div>
                <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', margin: '0 0 18px' }}>
                  the films that most define {friendName}'s taste profile
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
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>
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
                  {friendName}'s highest-rated films
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {taste.topRated.map(f => (
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
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 2 }}>{f.year}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--p-ink)', letterSpacing: '0.04em' }}>
                        {f.stars.toFixed(1)}★
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !taste && (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>profile not found.</p>
        )}
      </div>

      {/* ── Category Detail Panel ──────────────────────────────────────────── */}
      {selectedCategory && (
        <>
          <div
            onClick={() => setSelectedCategory(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
              zIndex: 40, backdropFilter: 'blur(2px)',
            }}
          />

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
                      <span style={{ color: 'var(--p-ink)' }}>{selectedCategory.avgRating.toFixed(1)}★ avg</span>
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

            {/* Film list — read-only, no click */}
            <div style={{ padding: '16px 28px 40px', flex: 1 }}>
              {panelFilms.length === 0 ? (
                <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)', marginTop: 24 }}>
                  no films found
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {panelFilms.map((f, i) => (
                    <div
                      key={f.film_id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '12px 0',
                        borderBottom: i < panelFilms.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                      }}
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
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--p-ink)', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {f.my_stars.toFixed(1)}★
                        </div>
                      )}
                    </div>
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
