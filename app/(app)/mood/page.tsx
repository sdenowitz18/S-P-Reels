'use client'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import Image from 'next/image'
import { LetterLoader } from '@/components/letter-loader'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Friend { id: string; name: string }

interface MemberTaste { id: string; letters: string | null }

interface MoodFilm {
  id: string
  title: string
  year: number | null
  poster_path: string | null
  director: string | null
  kind: 'movie' | 'tv' | null
  roomScore: number
  memberScores: Record<string, number>
}

interface DimRow {
  dimKey: string
  leftLabel: string; rightLabel: string
  filmScore: number   // 0 = full left, 100 = full right
}

interface PanelData {
  synopsis: string | null
  dimBreakdown: DimRow[]
  matchScore: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 70 ? 'var(--s-ink)' : s >= 45 ? 'var(--ink-2)' : 'var(--p-ink)'
}

function memberProse(score: number, firstName: string): string {
  if (score >= 88) return `${firstName} will love this`
  if (score >= 75) return `strong fit for ${firstName}`
  if (score >= 62) return `good match for ${firstName}`
  if (score >= 50) return `decent for ${firstName}`
  return `mixed for ${firstName}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FriendChip({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--serif-body)', fontSize: 14,
        border: selected ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)',
        background: selected ? 'var(--ink)' : 'var(--paper)',
        color: selected ? 'var(--paper)' : 'var(--ink)',
        transition: 'all 150ms',
      }}
    >
      {name}
    </button>
  )
}

function RoomMemberPip({ name, isYou, letters }: { name: string; isYou?: boolean; letters?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 48 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 600, color: 'var(--paper)',
      }}>
        {(isYou ? 'you' : name).charAt(0).toUpperCase()}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>
        {isYou ? 'you' : name.split(' ')[0]}
      </div>
      {letters && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '0.12em' }}>
          {letters}
        </div>
      )}
    </div>
  )
}

/** Carousel card — portrait poster, score overlay, click to open panel */
function CarouselCard({
  film, selfId, friends, selectedFriendIds, onClick,
}: {
  film: MoodFilm
  selfId: string
  friends: Friend[]
  selectedFriendIds: string[]
  onClick: () => void
}) {
  const poster = film.poster_path ? posterUrl(film.poster_path, 'w342') : null
  const allIds = [selfId, ...selectedFriendIds]
  const isGroup = allIds.length > 1
  const color = scoreColor(film.roomScore)

  const labelFor = (id: string) => {
    if (id === selfId) return 'you'
    return friends.find(f => f.id === id)?.name.split(' ')[0] ?? 'them'
  }

  return (
    <button
      onClick={onClick}
      style={{
        width: 190, flexShrink: 0, cursor: 'pointer',
        background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
        borderRadius: 12, overflow: 'hidden', textAlign: 'left',
        padding: 0, transition: 'transform 120ms, box-shadow 120ms',
        scrollSnapAlign: 'start',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {/* Poster */}
      <div style={{ width: '100%', height: 270, background: 'var(--bone)', position: 'relative' }}>
        {poster && <Image src={poster} alt={film.title} fill style={{ objectFit: 'cover' }} />}
        {/* Room score overlay */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(24,22,18,0.82)', borderRadius: 8,
          padding: '5px 9px', backdropFilter: 'blur(4px)',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 5, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: 1 }}>
            {isGroup ? 'ROOM' : 'MATCH'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 17, fontWeight: 700, color, lineHeight: 1 }}>
            {film.roomScore}<span style={{ fontSize: 9, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>%</span>
          </div>
        </div>
        {film.kind === 'tv' && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(24,22,18,0.75)', borderRadius: 4,
            padding: '2px 7px', fontFamily: 'var(--mono)', fontSize: 7,
            color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em',
          }}>
            SERIES
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.25, marginBottom: 3 }}>
          {film.title}
        </div>
        <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 10, color: 'var(--ink-4)', marginBottom: isGroup ? 10 : 0 }}>
          {[film.director, film.year].filter(Boolean).join(' · ')}
        </div>

        {/* Per-member mini scores (group only) */}
        {isGroup && Object.keys(film.memberScores).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allIds.filter(id => film.memberScores[id] != null).map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 7.5, color: 'var(--ink-4)' }}>
                  {labelFor(id)}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
                  color: scoreColor(film.memberScores[id]),
                }}>
                  {film.memberScores[id]}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

/** Dimension axis bar — shows where the film sits between two poles */
function DimBar({ row }: { row: DimRow }) {
  const pct = row.filmScore  // 0=left, 100=right
  const leanLeft = pct < 45
  const leanRight = pct > 55
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.06em',
          color: leanLeft ? 'var(--ink)' : 'var(--ink-4)', textTransform: 'uppercase',
        }}>{row.leftLabel}</span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.06em',
          color: leanRight ? 'var(--ink)' : 'var(--ink-4)', textTransform: 'uppercase',
        }}>{row.rightLabel}</span>
      </div>
      <div style={{ height: 4, background: 'var(--paper-edge)', borderRadius: 999, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', transform: 'translate(-50%,-50%)',
          left: `${pct}%`,
          width: 10, height: 10, borderRadius: '50%',
          background: 'var(--ink)', border: '2px solid var(--paper)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        }} />
      </div>
    </div>
  )
}

/** Slide-in film detail panel overlay */
function MoodFilmPanel({
  film, panelData, panelLoading,
  selfId, selfName, friends, selectedFriendIds,
  onClose, onSave, saved,
}: {
  film: MoodFilm
  panelData: PanelData | null
  panelLoading: boolean
  selfId: string
  selfName: string
  friends: Friend[]
  selectedFriendIds: string[]
  onClose: () => void
  onSave: () => void
  saved: boolean
}) {
  const poster = film.poster_path ? posterUrl(film.poster_path, 'w342') : null
  const allIds = [selfId, ...selectedFriendIds]
  const isGroup = allIds.length > 1

  const nameFor = (id: string) => {
    if (id === selfId) return selfName.split(' ')[0] || 'you'
    return friends.find(f => f.id === id)?.name.split(' ')[0] ?? 'them'
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(24,22,18,0.5)',
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
      }}
    >
      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(460px, 100vw)',
          background: 'var(--paper)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Poster hero */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '60%', background: 'var(--bone)', flexShrink: 0 }}>
          {poster && <Image src={poster} alt={film.title} fill style={{ objectFit: 'cover' }} />}
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(24,22,18,0.7)', border: 'none', cursor: 'pointer',
              color: '#fff', fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >×</button>
          {/* Room score */}
          <div style={{
            position: 'absolute', bottom: 14, left: 14,
            background: 'rgba(24,22,18,0.78)', borderRadius: 10,
            padding: '8px 14px', backdropFilter: 'blur(6px)',
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 6, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', marginBottom: 2 }}>
              {isGroup ? 'CONSENSUS' : 'MATCH'}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 26, fontWeight: 700, color: scoreColor(film.roomScore), lineHeight: 1 }}>
              {film.roomScore}<span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>%</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 24px 40px', flex: 1 }}>
          {/* Title */}
          <h2 style={{ fontFamily: 'var(--serif-display)', fontSize: 24, fontWeight: 500, margin: '0 0 4px', lineHeight: 1.2 }}>
            {film.title}
          </h2>
          <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginBottom: 20 }}>
            {[film.director, film.year, film.kind === 'tv' ? 'series' : null].filter(Boolean).join(' · ')}
          </div>

          {/* Per-member scores */}
          <div style={{ marginBottom: 24 }}>
            {allIds.map(id => {
              const score = film.memberScores[id] ?? film.roomScore
              const name = nameFor(id)
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                      {id === selfId ? 'you' : name}
                    </div>
                    <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)' }}>
                      {memberProse(score, id === selfId ? 'you' : name)}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: scoreColor(score), lineHeight: 1, flexShrink: 0 }}>
                    {score}<span style={{ fontSize: 9, fontWeight: 400, color: 'var(--ink-4)' }}>%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: '0.5px solid var(--paper-edge)', marginBottom: 20 }} />

          {/* Film dimensions */}
          {panelLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <LetterLoader label="loading" size={56} />
            </div>
          ) : panelData?.dimBreakdown && panelData.dimBreakdown.length > 0 ? (
            <div style={{ marginBottom: 24 }}>
              <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.12em', marginBottom: 14 }}>
                ★ WHAT THIS FILM IS
              </div>
              {panelData.dimBreakdown.slice(0, 4).map(row => (
                <DimBar key={row.dimKey} row={row} />
              ))}
            </div>
          ) : null}

          {panelData?.synopsis && (
            <>
              <div style={{ borderTop: '0.5px solid var(--paper-edge)', marginBottom: 16 }} />
              <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
                {panelData.synopsis.slice(0, 240)}{panelData.synopsis.length > 240 ? '…' : ''}
              </p>
            </>
          )}

          <div style={{ marginTop: 24 }}>
            <button
              className="btn"
              onClick={onSave}
              disabled={saved}
              style={{ width: '100%', padding: '13px 20px', fontSize: 13, borderRadius: 999, opacity: saved ? 0.5 : 1 }}
            >
              {saved ? 'saved to watchlists ✓' : 'save to watchlists →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Multi-person watchlist save modal */
function SaveModal({
  film, selfId, selfName, friends, selectedFriendIds,
  savedIds, onClose, onConfirm,
}: {
  film: MoodFilm
  selfId: string
  selfName: string
  friends: Friend[]
  selectedFriendIds: string[]
  savedIds: Set<string>
  onClose: () => void
  onConfirm: (filmId: string, memberIds: string[]) => Promise<void>
}) {
  const allIds = [selfId, ...selectedFriendIds]
  const [checked, setChecked] = useState<Set<string>>(new Set(allIds))
  const [saving, setSaving] = useState(false)

  const nameFor = (id: string) =>
    id === selfId ? (selfName || 'you') : (friends.find(f => f.id === id)?.name ?? 'them')

  const toggle = (id: string) =>
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleConfirm = async () => {
    const targets = [...checked]
    if (!targets.length) return
    setSaving(true)
    await onConfirm(film.id, targets)
    setSaving(false)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(24,22,18,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--paper)', borderRadius: 16, padding: '28px 28px 24px',
          maxWidth: 400, width: '100%',
          border: '0.5px solid var(--paper-edge)',
        }}
      >
        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 8 }}>★ SAVE TO WATCHLIST</div>
        <h3 style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, margin: '0 0 4px', lineHeight: 1.2 }}>
          {film.title}
        </h3>
        <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', margin: '0 0 20px' }}>
          choose whose list to add it to
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
          {allIds.map(id => {
            const name = nameFor(id)
            const isChecked = checked.has(id)
            const alreadySaved = savedIds.has(film.id) // rough check; could be more granular
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${isChecked ? 'var(--ink)' : 'var(--paper-edge)'}`,
                  background: isChecked ? 'var(--ink)' : 'transparent',
                  transition: 'all 120ms',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: isChecked ? 'var(--paper)' : 'transparent',
                  border: `2px solid ${isChecked ? 'var(--ink)' : 'var(--paper-edge)'}`,
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'var(--ink)',
                }}>
                  {isChecked ? '✓' : ''}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: isChecked ? 'var(--paper)' : 'var(--ink)' }}>
                    {id === selfId ? 'you' : name}
                  </div>
                  {id !== selfId && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: isChecked ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 1 }}>
                      adds to their watchlist
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn"
            onClick={handleConfirm}
            disabled={saving || checked.size === 0}
            style={{ flex: 1, padding: '11px 16px', fontSize: 13, borderRadius: 999, opacity: checked.size === 0 ? 0.4 : 1 }}
          >
            {saving ? 'saving…' : `save for ${checked.size} →`}
          </button>
          <button
            className="btn btn-soft"
            onClick={onClose}
            style={{ padding: '11px 14px', fontSize: 13, borderRadius: 999 }}
          >
            cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoodPage() {
  const [step, setStep]             = useState<'who' | 'room'>('who')
  const [selfId, setSelfId]         = useState('')
  const [selfName, setSelfName]     = useState('you')
  const [friends, setFriends]       = useState<Friend[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [memberTaste, setMemberTaste] = useState<MemberTaste[]>([])
  const tasteLoadedRef = useRef(false)

  const [kind, setKind]             = useState<'any' | 'movie' | 'tv'>('any')
  const [genre, setGenre]           = useState<string | null>(null)
  const [newReleases, setNewReleases] = useState(false)

  const [results, setResults]       = useState<MoodFilm[]>([])
  const [shownIds, setShownIds]     = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasTasteCode, setHasTasteCode] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Panel state
  const [selectedFilm, setSelectedFilm] = useState<MoodFilm | null>(null)
  const [panelData, setPanelData]       = useState<PanelData | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)

  // Save modal state
  const [showSaveModal, setShowSaveModal] = useState<MoodFilm | null>(null)
  const [savedIds, setSavedIds]           = useState<Set<string>>(new Set())

  // ── Load self + friends ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingFriends(true)
      try {
        const [meRes, friendsRes] = await Promise.all([
          fetch('/api/auth/me').then(r => r.json()),
          fetch('/api/friends').then(r => r.json()),
        ])
        setSelfId(meRes?.id ?? '')
        setSelfName(meRes?.name ?? 'you')
        const fl: Friend[] = friendsRes?.friends ?? []
        setFriends(fl)
        if (fl.length === 0) setStep('room')
      } catch {}
      setLoadingFriends(false)
    }
    load()
  }, [])

  // ── Lazy-load taste letters for room header ──────────────────────────────────
  useEffect(() => {
    if (step !== 'room' || tasteLoadedRef.current) return
    tasteLoadedRef.current = true
    const allIds = [selfId, ...selectedFriendIds]
    Promise.allSettled(
      allIds.map(id => {
        const url = id === selfId ? '/api/profile/taste' : `/api/friends/${id}/taste`
        return fetch(url).then(r => r.json()).then(data => ({
          id, letters: (data?.tasteCode?.letters ?? null) as string | null,
        }))
      })
    ).then(rs => {
      setMemberTaste(
        rs.filter((r): r is PromiseFulfilledResult<MemberTaste> => r.status === 'fulfilled').map(r => r.value)
      )
    })
  }, [step, selfId, selectedFriendIds])

  // ── Open film panel (fetch panel data) ──────────────────────────────────────
  const openPanel = async (film: MoodFilm) => {
    setSelectedFilm(film)
    setPanelData(null)
    setPanelLoading(true)
    try {
      const data = await fetch(`/api/films/${film.id}/panel`).then(r => r.json())
      setPanelData({
        synopsis: data.synopsis ?? null,
        dimBreakdown: data.dimBreakdown ?? [],
        matchScore: data.matchScore ?? null,
      })
    } catch {}
    setPanelLoading(false)
  }

  const closePanel = () => { setSelectedFilm(null); setPanelData(null) }

  // ── Generate results ─────────────────────────────────────────────────────────
  const generate = async (append = false) => {
    if (!append) {
      setLoading(true); setResults([]); setShownIds([]); setError(null)
    } else {
      setLoadingMore(true)
    }
    const exclude = append ? shownIds : []
    const genreKeyword = genre
      ? (GENRE_GROUPS.find(g => g.label === genre)?.keywords[0] ?? genre.toLowerCase())
      : undefined
    try {
      const res = await fetch('/api/mood/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: selectedFriendIds,
          filters: { kind: kind === 'any' ? undefined : kind, aiGenre: genreKeyword, newReleases: newReleases || undefined },
          limit: 5, exclude,
        }),
      })
      const data = await res.json()
      if (!data.films?.length) {
        setError(append ? 'no more options to show' : 'nothing found — try changing the filters')
        return
      }
      const newFilms: MoodFilm[] = data.films
      const newIds = newFilms.map((f: MoodFilm) => f.id)
      if (append) {
        setResults(prev => [...prev, ...newFilms])
        setShownIds(prev => [...prev, ...newIds])
      } else {
        setResults(newFilms); setShownIds(newIds); setHasTasteCode(data.hasTasteCode)
      }
    } catch {
      setError('something went wrong — try again')
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }

  // ── Save film to member watchlists ───────────────────────────────────────────
  const handleSaveFilm = async (filmId: string, memberIds: string[]) => {
    await fetch('/api/mood/save-film', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId, memberIds }),
    })
    setSavedIds(prev => new Set([...prev, filmId]))
  }

  const enterRoom = (friendIds: string[]) => {
    setSelectedFriendIds(friendIds)
    tasteLoadedRef.current = false
    setStep('room')
    setResults([]); setShownIds([]); setError(null)
  }

  const lettersFor = (id: string) => memberTaste.find(t => t.id === id)?.letters ?? null
  const allMemberIds = [selfId, ...selectedFriendIds]

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: "Who's watching?"
  // ─────────────────────────────────────────────────────────────────────────────

  if (step === 'who') {
    return (
      <AppShell active="mood">
        <div style={{ padding: 'clamp(40px,6vw,72px) clamp(24px,6vw,72px) 96px', maxWidth: 680, margin: '0 auto' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ MOOD ROOM</div>
          <h1 className="t-display" style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            who&rsquo;s watching?
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 380, marginBottom: 36 }}>
            the room scores options for everyone you add.
          </p>

          {loadingFriends ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <LetterLoader label="loading" size={72} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                <FriendChip name="you" selected onClick={() => {}} />
                {friends.map(f => (
                  <FriendChip
                    key={f.id}
                    name={f.name}
                    selected={selectedFriendIds.includes(f.id)}
                    onClick={() => setSelectedFriendIds(prev =>
                      prev.includes(f.id) ? prev.filter(x => x !== f.id) : [...prev, f.id]
                    )}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn" onClick={() => enterRoom(selectedFriendIds)} style={{ padding: '12px 24px', fontSize: 14, borderRadius: 999 }}>
                  {selectedFriendIds.length === 0 ? 'just me →' : `room of ${selectedFriendIds.length + 1} →`}
                </button>
                {selectedFriendIds.length > 0 && (
                  <button className="btn btn-soft" onClick={() => enterRoom([])} style={{ padding: '10px 16px', fontSize: 12, borderRadius: 999 }}>
                    just me →
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </AppShell>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP: Room
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AppShell active="mood">
      {/* Film detail panel overlay */}
      {selectedFilm && (
        <MoodFilmPanel
          film={selectedFilm}
          panelData={panelData}
          panelLoading={panelLoading}
          selfId={selfId}
          selfName={selfName}
          friends={friends}
          selectedFriendIds={selectedFriendIds}
          onClose={closePanel}
          onSave={() => { closePanel(); setShowSaveModal(selectedFilm) }}
          saved={savedIds.has(selectedFilm.id)}
        />
      )}

      {/* Multi-person save modal */}
      {showSaveModal && (
        <SaveModal
          film={showSaveModal}
          selfId={selfId}
          selfName={selfName}
          friends={friends}
          selectedFriendIds={selectedFriendIds}
          savedIds={savedIds}
          onClose={() => setShowSaveModal(null)}
          onConfirm={handleSaveFilm}
        />
      )}

      <div style={{ padding: 'clamp(28px,5vw,48px) clamp(16px,5vw,64px) 96px', maxWidth: 900, margin: '0 auto' }}>

        {/* ── Room header ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 12, letterSpacing: '0.12em' }}>
              ★ MOOD ROOM
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <RoomMemberPip name={selfName} isYou letters={lettersFor(selfId)} />
              {selectedFriendIds.map(id => {
                const friend = friends.find(f => f.id === id)
                if (!friend) return null
                return <RoomMemberPip key={id} name={friend.name} letters={lettersFor(id)} />
              })}
            </div>
          </div>
          {friends.length > 0 && (
            <button
              onClick={() => { setStep('who'); setResults([]); setShownIds([]); setError(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', padding: 0, marginTop: 4 }}
            >
              {selectedFriendIds.length > 0 ? 'edit room' : 'add someone'}
            </button>
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>FORMAT</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['any', 'movie', 'tv'] as const).map(k => (
                <button key={k} onClick={() => setKind(k)} style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                  border: kind === k ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                  background: kind === k ? 'var(--ink)' : 'transparent',
                  color: kind === k ? 'var(--paper)' : 'var(--ink-3)',
                }}>
                  {k === 'any' ? 'both' : k === 'movie' ? 'film' : 'series'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>GENRE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {GENRE_GROUPS.map(g => (
                <button key={g.label} onClick={() => setGenre(genre === g.label ? null : g.label)} style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                  border: genre === g.label ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)',
                  background: genre === g.label ? 'var(--ink)' : 'transparent',
                  color: genre === g.label ? 'var(--paper)' : 'var(--ink-3)',
                }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>ERA</div>
            <button onClick={() => setNewReleases(nr => !nr)} style={{
              padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: newReleases ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)',
              background: newReleases ? 'var(--ink)' : 'transparent',
              color: newReleases ? 'var(--paper)' : 'var(--ink-3)',
            }}>
              new releases
            </button>
          </div>
        </div>

        {/* ── Generate button ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <button
            className="btn"
            onClick={() => generate(false)}
            disabled={loading}
            style={{ padding: '11px 22px', fontSize: 13, borderRadius: 999, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'finding options…' : 'find five options →'}
          </button>
          {results.length > 0 && !loading && (
            <button className="btn btn-soft" onClick={() => generate(false)} style={{ padding: '9px 14px', fontSize: 11, borderRadius: 999 }}>
              start over
            </button>
          )}
        </div>

        {error && !loading && (
          <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 12, fontFamily: 'var(--serif-italic)' }}>
            {error}
          </p>
        )}

        {/* ── Results carousel ──────────────────────────────────────────── */}
        {results.length > 0 && !loading && (
          <div style={{ marginTop: 28 }}>
            {hasTasteCode && (
              <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 14, letterSpacing: '0.12em' }}>
                ★ RANKED BY {allMemberIds.length > 1 ? 'CONSENSUS HARMONY SCORE' : 'TASTE MATCH'}
              </div>
            )}

            {/* Horizontal carousel */}
            <div style={{
              display: 'flex', gap: 12,
              overflowX: 'auto', paddingBottom: 16,
              scrollSnapType: 'x mandatory',
              scrollPaddingLeft: 4,
              // hide scrollbar but keep scrolling
              msOverflowStyle: 'none', scrollbarWidth: 'none',
            }}>
              {results.map(film => (
                <CarouselCard
                  key={film.id}
                  film={film}
                  selfId={selfId}
                  friends={friends}
                  selectedFriendIds={selectedFriendIds}
                  onClick={() => openPanel(film)}
                />
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <button
                className="btn btn-soft"
                onClick={() => generate(true)}
                disabled={loadingMore}
                style={{ padding: '9px 18px', fontSize: 11, borderRadius: 999, opacity: loadingMore ? 0.5 : 1 }}
              >
                {loadingMore ? 'finding more options…' : '5 more options →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
