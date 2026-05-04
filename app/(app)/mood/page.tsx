'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import Image from 'next/image'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Friend { id: string; name: string }

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

// ── Sub-components ────────────────────────────────────────────────────────────

function MemberChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13,
        border: `${active ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink-3)',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--s-ink)' : score >= 45 ? 'var(--ink-2)' : 'var(--p-ink)'
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700,
      color, lineHeight: 1, flexShrink: 0,
    }}>
      {score}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-4)' }}>%</span>
    </div>
  )
}

function FilmCard({
  film, friends, currentUserId, memberIds, onSave, saved,
}: {
  film: MoodFilm
  friends: Friend[]
  currentUserId: string
  memberIds: string[]
  onSave: (filmId: string) => void
  saved: boolean
}) {
  const poster = film.poster_path ? posterUrl(film.poster_path, 'w185') : null
  const hasMultipleMembers = memberIds.length > 1
  const memberName = (id: string) => {
    if (id === currentUserId) return 'you'
    return friends.find(f => f.id === id)?.name ?? 'them'
  }

  return (
    <div style={{ display: 'flex', gap: 16, padding: '18px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
      {/* Poster */}
      <div style={{ width: 56, height: 84, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bone)', position: 'relative' }}>
        {poster && <Image src={poster} alt={film.title} fill style={{ objectFit: 'cover' }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500, lineHeight: 1.2, marginBottom: 3 }}>
          {film.title}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginBottom: 10 }}>
          {film.director}{film.director && film.year ? ' · ' : ''}{film.year}
          {film.kind === 'tv' ? ' · series' : ''}
        </div>

        {/* Member scores breakdown */}
        {hasMultipleMembers && Object.keys(film.memberScores).length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            {memberIds.filter(id => film.memberScores[id] != null).map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                  {memberName(id).toUpperCase()}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
                  color: film.memberScores[id] >= 70 ? 'var(--s-ink)' : film.memberScores[id] >= 45 ? 'var(--ink-2)' : 'var(--p-ink)',
                }}>
                  {film.memberScores[id]}%
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => onSave(film.id)}
          className="btn btn-soft"
          style={{ padding: '5px 12px', fontSize: 11, borderRadius: 999, opacity: saved ? 0.5 : 1 }}
        >
          {saved ? 'saved ✓' : 'save to watchlist →'}
        </button>
      </div>

      {/* Room score */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 4 }}>
          {hasMultipleMembers ? 'ROOM' : 'MATCH'}
        </div>
        <ScoreBadge score={film.roomScore} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoodPage() {
  // ── Friends ──────────────────────────────────────────────────────────────────
  const [friends, setFriends]       = useState<Friend[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [memberIds, setMemberIds]   = useState<string[]>([])  // friend IDs in room (current user always included server-side)

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [kind, setKind]             = useState<'any' | 'movie' | 'tv'>('any')
  const [genre, setGenre]           = useState<string | null>(null)
  const [newReleases, setNewReleases] = useState(false)

  // ── Results ──────────────────────────────────────────────────────────────────
  const [results, setResults]       = useState<MoodFilm[]>([])
  const [shownIds, setShownIds]     = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasTasteCode, setHasTasteCode] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set())

  // ── Load friends on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(data => {
        setFriends(data.friends ?? [])
      })
      .catch(() => {})

    // Get current user ID
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data?.id) setCurrentUserId(data.id)
      })
      .catch(() => {})
  }, [])

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const generate = async (append = false) => {
    if (!append) {
      setLoading(true)
      setResults([])
      setShownIds([])
      setError(null)
    } else {
      setLoadingMore(true)
    }

    const exclude = append ? shownIds : []
    const offset  = 0  // we pass exclude list, not offset-based pagination

    try {
      // Map genre label to a keyword for AI genre matching
      const genreKeyword = genre
        ? (GENRE_GROUPS.find(g => g.label === genre)?.keywords[0] ?? genre.toLowerCase())
        : undefined

      const res = await fetch('/api/mood/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds,
          filters: {
            kind: kind === 'any' ? undefined : kind,
            aiGenre: genreKeyword,
            newReleases: newReleases || undefined,
          },
          offset,
          limit: 5,
          exclude,
        }),
      })
      const data = await res.json()

      if (!data.films?.length) {
        setError(append ? 'no more films to show' : 'nothing found — try changing the filters')
        return
      }

      const newFilms: MoodFilm[] = data.films
      const newIds = newFilms.map((f: MoodFilm) => f.id)

      if (append) {
        setResults(prev => [...prev, ...newFilms])
        setShownIds(prev => [...prev, ...newIds])
      } else {
        setResults(newFilms)
        setShownIds(newIds)
        setHasTasteCode(data.hasTasteCode)
      }
    } catch {
      setError('something went wrong — try again')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const saveToWatchlist = async (filmId: string) => {
    setSavedIds(prev => new Set(prev).add(filmId))
    await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId, list: 'watchlist', audience: ['me'] }),
    })
  }

  const toggleFriend = (id: string) => {
    setMemberIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // All members in room for display: current user + selected friends
  const allMemberIds = currentUserId ? [currentUserId, ...memberIds] : memberIds

  return (
    <AppShell active="mood">
      <div style={{ padding: 'clamp(28px,5vw,56px) clamp(16px,5vw,64px) 96px', maxWidth: 800, margin: '0 auto' }}>

        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ MOOD ROOM</div>
        <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1, marginBottom: 8 }}>
          find something{' '}
          <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sp-ink)' }}>to watch</span>
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 480 }}>
          scored against your taste{friends.length > 0 ? ' — and everyone in the room' : ''}.
          the more people, the harder it has to work.
        </p>

        {/* ── Who's in the room ──────────────────────────────────────────── */}
        <div style={{ marginTop: 36 }}>
          <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 12, letterSpacing: '0.12em' }}>
            WHO'S WATCHING
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {/* Current user chip — always active, not removable */}
            <MemberChip label="you" active onClick={() => {}} />
            {friends.map(f => (
              <MemberChip
                key={f.id}
                label={f.name}
                active={memberIds.includes(f.id)}
                onClick={() => toggleFriend(f.id)}
              />
            ))}
            {friends.length === 0 && (
              <span style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)' }}>
                add friends to watch together
              </span>
            )}
          </div>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          {/* Kind */}
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.1em' }}>FORMAT</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['any', 'movie', 'tv'] as const).map(k => (
                <button key={k} onClick={() => setKind(k)} style={{
                  padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
                  border: `${kind === k ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
                  background: kind === k ? 'var(--ink)' : 'transparent',
                  color: kind === k ? 'var(--paper)' : 'var(--ink-3)',
                }}>
                  {k === 'any' ? 'both' : k === 'movie' ? 'film' : 'series'}
                </button>
              ))}
            </div>
          </div>

          {/* Genre */}
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.1em' }}>GENRE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {GENRE_GROUPS.map(g => (
                <button key={g.label} onClick={() => setGenre(genre === g.label ? null : g.label)} style={{
                  padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                  border: `${genre === g.label ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
                  background: genre === g.label ? 'var(--ink)' : 'transparent',
                  color: genre === g.label ? 'var(--paper)' : 'var(--ink-3)',
                }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* New releases */}
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.1em' }}>ERA</div>
            <button onClick={() => setNewReleases(nr => !nr)} style={{
              padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: `${newReleases ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
              background: newReleases ? 'var(--ink)' : 'transparent',
              color: newReleases ? 'var(--paper)' : 'var(--ink-3)',
            }}>
              new releases
            </button>
          </div>
        </div>

        {/* ── Generate button ───────────────────────────────────────────────── */}
        <div style={{ marginTop: 28, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => generate(false)}
            disabled={loading}
            style={{ padding: '12px 24px', fontSize: 13, borderRadius: 999, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'finding films…' : 'generate five films →'}
          </button>
          {results.length > 0 && !loading && (
            <button
              className="btn btn-soft"
              onClick={() => generate(false)}
              style={{ padding: '10px 16px', fontSize: 12, borderRadius: 999 }}
            >
              start over
            </button>
          )}
        </div>

        {error && !loading && (
          <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 16, fontFamily: 'var(--serif-italic)' }}>
            {error}
          </p>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {results.length > 0 && !loading && (
          <div style={{ marginTop: 36 }}>
            {hasTasteCode && (
              <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 14, letterSpacing: '0.12em' }}>
                ★ RANKED BY {allMemberIds.length > 1 ? 'CONSENSUS HARMONY SCORE' : 'TASTE MATCH'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map(film => (
                <FilmCard
                  key={film.id}
                  film={film}
                  friends={friends}
                  currentUserId={currentUserId}
                  memberIds={allMemberIds}
                  onSave={saveToWatchlist}
                  saved={savedIds.has(film.id)}
                />
              ))}
            </div>

            {/* Load more */}
            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-soft"
                onClick={() => generate(true)}
                disabled={loadingMore}
                style={{ padding: '10px 20px', fontSize: 12, borderRadius: 999, opacity: loadingMore ? 0.5 : 1 }}
              >
                {loadingMore ? 'finding more…' : 'show 5 more →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
