'use client'
import { useEffect, useRef, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import Image from 'next/image'
import { LetterLoader } from '@/components/letter-loader'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Friend { id: string; name: string }

// Taste info fetched lazily for the room header (not the selection screen)
interface MemberTaste {
  id: string
  letters: string | null
}

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

/** Simple name chip for the selection screen — no taste fetch needed */
function FriendChip({
  name, selected, onClick,
}: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', borderRadius: 999, cursor: 'pointer',
        fontFamily: 'var(--serif-body)', fontSize: 14,
        border: `${selected ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
        background: selected ? 'var(--ink)' : 'var(--paper)',
        color: selected ? 'var(--paper)' : 'var(--ink)',
        transition: 'all 150ms',
      }}
    >
      {name}
    </button>
  )
}

/** Room header pip — shows initials + name + letters (loaded lazily) */
function RoomMemberPip({
  name, isYou, letters,
}: { name: string; isYou?: boolean; letters?: string | null }) {
  const display = isYou ? 'you' : name
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 48 }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 600, color: 'var(--paper)',
      }}>
        {display.charAt(0).toUpperCase()}
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

function ScoreBadge({ score, isGroup }: { score: number; isGroup?: boolean }) {
  const color = score >= 70 ? 'var(--s-ink)' : score >= 45 ? 'var(--ink-2)' : 'var(--p-ink)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 2 }}>
        {isGroup ? 'ROOM' : 'MATCH'}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 21, fontWeight: 700, color, lineHeight: 1 }}>
        {score}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--ink-4)' }}>%</span>
      </div>
    </div>
  )
}

function FilmCard({
  film, selfId, friends, selectedFriendIds, onSave, saved,
}: {
  film: MoodFilm
  selfId: string
  friends: Friend[]
  selectedFriendIds: string[]
  onSave: (filmId: string) => void
  saved: boolean
}) {
  const poster = film.poster_path ? posterUrl(film.poster_path, 'w185') : null
  const allIds = [selfId, ...selectedFriendIds]
  const isGroup = allIds.length > 1

  const labelFor = (id: string) => {
    if (id === selfId) return 'YOU'
    return (friends.find(f => f.id === id)?.name.split(' ')[0] ?? 'them').toUpperCase()
  }

  return (
    <div style={{ display: 'flex', gap: 14, padding: '16px 18px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
      {/* Poster */}
      <div style={{ width: 52, height: 78, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--bone)', position: 'relative' }}>
        {poster && <Image src={poster} alt={film.title} fill style={{ objectFit: 'cover' }} />}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500, lineHeight: 1.2, marginBottom: 2 }}>
          {film.title}
        </div>
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginBottom: 8 }}>
          {film.director}{film.director && film.year ? ' · ' : ''}{film.year}
          {film.kind === 'tv' ? ' · series' : ''}
        </div>

        {/* Per-member breakdown (group only) */}
        {isGroup && Object.keys(film.memberScores).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {allIds.filter(id => film.memberScores[id] != null).map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                  {labelFor(id)}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
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
          style={{ padding: '4px 11px', fontSize: 10, borderRadius: 999, opacity: saved ? 0.5 : 1 }}
        >
          {saved ? 'saved ✓' : 'save to watchlist →'}
        </button>
      </div>

      {/* Room score */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <ScoreBadge score={film.roomScore} isGroup={isGroup} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoodPage() {
  // ── Step: who → room ──────────────────────────────────────────────────────
  const [step, setStep]             = useState<'who' | 'room'>('who')

  // ── Friends (fast — just names) ───────────────────────────────────────────
  const [selfId, setSelfId]         = useState('')
  const [selfName, setSelfName]     = useState('you')
  const [friends, setFriends]       = useState<Friend[]>([])
  const [loadingFriends, setLoadingFriends] = useState(true)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])

  // ── Room header taste letters (lazy-loaded after entering room) ───────────
  const [memberTaste, setMemberTaste] = useState<MemberTaste[]>([])
  const tasteLoadedRef = useRef(false)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [kind, setKind]             = useState<'any' | 'movie' | 'tv'>('any')
  const [genre, setGenre]           = useState<string | null>(null)
  const [newReleases, setNewReleases] = useState(false)

  // ── Results ───────────────────────────────────────────────────────────────
  const [results, setResults]       = useState<MoodFilm[]>([])
  const [shownIds, setShownIds]     = useState<string[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasTasteCode, setHasTasteCode] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [savedIds, setSavedIds]     = useState<Set<string>>(new Set())

  // ── Load self + friends (fast — no taste computation) ─────────────────────
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
        // If no friends, skip directly to room
        if (fl.length === 0) setStep('room')
      } catch {}
      setLoadingFriends(false)
    }
    load()
  }, [])

  // ── Lazy-load taste letters for room header ────────────────────────────────
  useEffect(() => {
    if (step !== 'room' || tasteLoadedRef.current) return
    tasteLoadedRef.current = true

    const allIds = [selfId, ...selectedFriendIds]
    Promise.allSettled(
      allIds.map(id => {
        const url = id === selfId ? '/api/profile/taste' : `/api/friends/${id}/taste`
        return fetch(url).then(r => r.json()).then(data => ({
          id,
          letters: (data?.tasteCode?.letters ?? null) as string | null,
        }))
      })
    ).then(results => {
      const tastes: MemberTaste[] = results
        .filter((r): r is PromiseFulfilledResult<MemberTaste> => r.status === 'fulfilled')
        .map(r => r.value)
      setMemberTaste(tastes)
    })
  }, [step, selfId, selectedFriendIds])

  // ── Generate results ───────────────────────────────────────────────────────
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
    const genreKeyword = genre
      ? (GENRE_GROUPS.find(g => g.label === genre)?.keywords[0] ?? genre.toLowerCase())
      : undefined

    try {
      const res = await fetch('/api/mood/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberIds: selectedFriendIds,
          filters: {
            kind: kind === 'any' ? undefined : kind,
            aiGenre: genreKeyword,
            newReleases: newReleases || undefined,
          },
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

  const enterRoom = (friendIds: string[]) => {
    setSelectedFriendIds(friendIds)
    tasteLoadedRef.current = false  // reset so taste loads for the new member set
    setStep('room')
    setResults([])
    setShownIds([])
    setError(null)
  }

  const lettersFor = (id: string) => memberTaste.find(t => t.id === id)?.letters ?? null

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: "Who's watching?"
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'who') {
    return (
      <AppShell active="mood">
        <div style={{ padding: 'clamp(40px,6vw,72px) clamp(24px,6vw,72px) 96px', maxWidth: 680, margin: '0 auto' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ MOOD ROOM</div>
          <h1 className="t-display" style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            who&rsquo;s watching?
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 380, marginBottom: 36 }}>
            the room scores films for everyone you add.
          </p>

          {loadingFriends ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <LetterLoader label="loading" size={72} />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                {/* Self chip — always "selected" visually, always included */}
                <FriendChip name="you" selected onClick={() => {}} />
                {/* Friends */}
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
                <button
                  className="btn"
                  onClick={() => enterRoom(selectedFriendIds)}
                  style={{ padding: '12px 24px', fontSize: 14, borderRadius: 999 }}
                >
                  {selectedFriendIds.length === 0
                    ? 'just me →'
                    : `room of ${selectedFriendIds.length + 1} →`}
                </button>
                {selectedFriendIds.length > 0 && (
                  <button
                    className="btn btn-soft"
                    onClick={() => enterRoom([])}
                    style={{ padding: '10px 16px', fontSize: 12, borderRadius: 999 }}
                  >
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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: Room UI
  // ─────────────────────────────────────────────────────────────────────────

  const allMemberIds = [selfId, ...selectedFriendIds]

  return (
    <AppShell active="mood">
      <div style={{ padding: 'clamp(28px,5vw,48px) clamp(16px,5vw,64px) 96px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── Room header ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 12, letterSpacing: '0.12em' }}>
              ★ MOOD ROOM
            </div>
            {/* Member pips — letters load in lazily */}
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <RoomMemberPip name={selfName} isYou letters={lettersFor(selfId)} />
              {selectedFriendIds.map(id => {
                const friend = friends.find(f => f.id === id)
                if (!friend) return null
                return (
                  <RoomMemberPip
                    key={id}
                    name={friend.name}
                    letters={lettersFor(id)}
                  />
                )
              })}
            </div>
          </div>
          {/* Edit button */}
          {friends.length > 0 && (
            <button
              onClick={() => { setStep('who'); setResults([]); setShownIds([]); setError(null) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
                fontSize: 12, color: 'var(--ink-4)', padding: 0, marginTop: 4,
              }}
            >
              {selectedFriendIds.length > 0 ? 'edit room' : 'add someone'}
            </button>
          )}
        </div>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginBottom: 24 }}>
          {/* Kind */}
          <div>
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>FORMAT</div>
            <div style={{ display: 'flex', gap: 5 }}>
              {(['any', 'movie', 'tv'] as const).map(k => (
                <button key={k} onClick={() => setKind(k)} style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
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
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>GENRE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {GENRE_GROUPS.map(g => (
                <button key={g.label} onClick={() => setGenre(genre === g.label ? null : g.label)} style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
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
            <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 7, letterSpacing: '0.1em' }}>ERA</div>
            <button onClick={() => setNewReleases(nr => !nr)} style={{
              padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
              border: `${newReleases ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
              background: newReleases ? 'var(--ink)' : 'transparent',
              color: newReleases ? 'var(--paper)' : 'var(--ink-3)',
            }}>
              new releases
            </button>
          </div>
        </div>

        {/* ── Generate ──────────────────────────────────────────────────────── */}
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
            <button
              className="btn btn-soft"
              onClick={() => generate(false)}
              style={{ padding: '9px 14px', fontSize: 11, borderRadius: 999 }}
            >
              start over
            </button>
          )}
        </div>

        {error && !loading && (
          <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 12, fontFamily: 'var(--serif-italic)' }}>
            {error}
          </p>
        )}

        {/* ── Results ───────────────────────────────────────────────────────── */}
        {results.length > 0 && !loading && (
          <div style={{ marginTop: 28 }}>
            {hasTasteCode && (
              <div className="t-meta" style={{ fontSize: 8, color: 'var(--ink-4)', marginBottom: 12, letterSpacing: '0.12em' }}>
                ★ RANKED BY {allMemberIds.length > 1 ? 'CONSENSUS HARMONY SCORE' : 'TASTE MATCH'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {results.map(film => (
                <FilmCard
                  key={film.id}
                  film={film}
                  selfId={selfId}
                  friends={friends}
                  selectedFriendIds={selectedFriendIds}
                  onSave={saveToWatchlist}
                  saved={savedIds.has(film.id)}
                />
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
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
