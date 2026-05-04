'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import { GENRE_GROUPS } from '@/lib/genre-groups'
import Image from 'next/image'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  name: string
  letters: string | null      // e.g. "OCPE" (null if not enough logs)
  topGenres: string[]         // top 2-3 genre labels
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

// ── Fetch member taste info ───────────────────────────────────────────────────

async function fetchMemberInfo(id: string, isSelf: boolean): Promise<MemberInfo | null> {
  try {
    const url = isSelf ? '/api/profile/taste' : `/api/friends/${id}/taste`
    const data = await fetch(url).then(r => r.json())
    const letters = data?.tasteCode?.letters ?? null
    const topGenres: string[] = (data?.simpleGenres ?? []).slice(0, 3).map((g: any) => g.label)
    return { id, name: data?.myName ?? data?.friendName ?? '', letters, topGenres }
  } catch {
    return null
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MemberCard({
  member, selected, onClick, isYou,
}: {
  member: MemberInfo
  selected: boolean
  onClick: () => void
  isYou?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
        border: `${selected ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
        background: selected ? 'var(--paper-2)' : 'var(--paper)',
        transition: 'all 150ms', minWidth: 140, maxWidth: 180,
      }}
    >
      {/* Name + selected indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, lineHeight: 1.2 }}>
          {isYou ? 'you' : member.name}
        </div>
        {selected && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink)', flexShrink: 0, marginTop: 4 }} />
        )}
      </div>
      {/* Taste code letters */}
      {member.letters ? (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.15em', color: 'var(--ink-2)', marginBottom: 6 }}>
          {member.letters}
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', marginBottom: 6, letterSpacing: '0.08em' }}>
          not enough logs
        </div>
      )}
      {/* Top genres */}
      {member.topGenres.length > 0 && (
        <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          {member.topGenres.slice(0, 2).join(' · ')}
        </div>
      )}
    </button>
  )
}

function RoomMemberPip({
  member, isYou,
}: { member: MemberInfo; isYou?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 52 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 600, color: 'var(--paper)',
      }}>
        {(isYou ? 'you' : member.name).charAt(0).toUpperCase()}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center' }}>
        {isYou ? 'you' : member.name.split(' ')[0]}
      </div>
      {member.letters && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '0.12em' }}>
          {member.letters}
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
  film, roomMembers, onSave, saved,
}: {
  film: MoodFilm
  roomMembers: MemberInfo[]
  onSave: (filmId: string) => void
  saved: boolean
}) {
  const poster = film.poster_path ? posterUrl(film.poster_path, 'w185') : null
  const isGroup = roomMembers.length > 1

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

        {/* Per-member score breakdown (group only) */}
        {isGroup && Object.keys(film.memberScores).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            {roomMembers.filter(m => film.memberScores[m.id] != null).map((m, idx) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
                  {(idx === 0 ? 'you' : m.name.split(' ')[0]).toUpperCase()}
                </span>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                  color: film.memberScores[m.id] >= 70 ? 'var(--s-ink)' : film.memberScores[m.id] >= 45 ? 'var(--ink-2)' : 'var(--p-ink)',
                }}>
                  {film.memberScores[m.id]}%
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
  // ── Step: 'who' (member selection) → 'room' (full UI) ────────────────────
  const [step, setStep]           = useState<'who' | 'room'>('who')

  // ── Member data ───────────────────────────────────────────────────────────
  const [selfInfo, setSelfInfo]   = useState<MemberInfo | null>(null)
  const [friendInfos, setFriendInfos] = useState<MemberInfo[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])

  // ── Filters ───────────────────────────────────────────────────────────────
  const [kind, setKind]           = useState<'any' | 'movie' | 'tv'>('any')
  const [genre, setGenre]         = useState<string | null>(null)
  const [newReleases, setNewReleases] = useState(false)

  // ── Results ───────────────────────────────────────────────────────────────
  const [results, setResults]     = useState<MoodFilm[]>([])
  const [shownIds, setShownIds]   = useState<string[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasTasteCode, setHasTasteCode] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [savedIds, setSavedIds]   = useState<Set<string>>(new Set())

  // ── Load self + friends ────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoadingMembers(true)
      try {
        // Fetch self + friends list in parallel
        const [meRes, friendsRes] = await Promise.all([
          fetch('/api/auth/me').then(r => r.json()),
          fetch('/api/friends').then(r => r.json()),
        ])

        const meId: string = meRes?.id ?? ''
        const friends: { id: string; name: string }[] = friendsRes?.friends ?? []

        // Fetch taste info for self + all friends in parallel
        const [selfData, ...friendData] = await Promise.all([
          fetchMemberInfo(meId, true),
          ...friends.map(f => fetchMemberInfo(f.id, false).then(info =>
            info ? { ...info, name: f.name } : { id: f.id, name: f.name, letters: null, topGenres: [] }
          )),
        ])

        // If self name is missing, fill from meRes
        if (selfData && !selfData.name) selfData.name = meRes?.name ?? 'you'

        setSelfInfo(selfData)
        setFriendInfos(friendData)

        // If no friends, skip directly to room
        if (friends.length === 0) {
          setStep('room')
        }
      } catch {}
      setLoadingMembers(false)
    }
    load()
  }, [])

  // ── All members in room (self always included) ────────────────────────────
  const roomMembers: MemberInfo[] = [
    ...(selfInfo ? [selfInfo] : []),
    ...friendInfos.filter(f => selectedFriendIds.includes(f.id)),
  ]

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

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const enterRoom = () => {
    setStep('room')
    setResults([])
    setShownIds([])
    setError(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: "Who's in the room?"
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'who') {
    return (
      <AppShell active="mood">
        <div style={{ padding: 'clamp(40px,6vw,72px) clamp(24px,6vw,72px) 96px', maxWidth: 700, margin: '0 auto' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ MOOD ROOM</div>
          <h1 className="t-display" style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>
            who&rsquo;s watching?
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 400, marginBottom: 36 }}>
            the room scores films for everyone you add.
          </p>

          {loadingMembers ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: 140, height: 90, background: 'var(--paper-2)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
                {/* Self — always selected, not removable */}
                {selfInfo && (
                  <MemberCard member={selfInfo} selected isYou onClick={() => {}} />
                )}
                {/* Friends */}
                {friendInfos.map(f => (
                  <MemberCard
                    key={f.id}
                    member={f}
                    selected={selectedFriendIds.includes(f.id)}
                    onClick={() => toggleFriend(f.id)}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  className="btn"
                  onClick={enterRoom}
                  style={{ padding: '12px 24px', fontSize: 14, borderRadius: 999 }}
                >
                  {selectedFriendIds.length === 0 ? 'just me →' : `room of ${selectedFriendIds.length + 1} →`}
                </button>
                {selectedFriendIds.length > 0 && (
                  <button
                    className="btn btn-soft"
                    onClick={() => { setSelectedFriendIds([]); enterRoom() }}
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

  return (
    <AppShell active="mood">
      <div style={{ padding: 'clamp(28px,5vw,48px) clamp(16px,5vw,64px) 96px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── Room header ───────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 12, letterSpacing: '0.12em' }}>
              ★ MOOD ROOM
            </div>
            {/* Member pips row */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {roomMembers.map((m, idx) => (
                <RoomMemberPip key={m.id} member={m} isYou={idx === 0} />
              ))}
            </div>
          </div>
          {/* Edit button */}
          {friendInfos.length > 0 && (
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

        {/* ── Generate button ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <button
            className="btn"
            onClick={() => generate(false)}
            disabled={loading}
            style={{ padding: '11px 22px', fontSize: 13, borderRadius: 999, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'finding films…' : 'generate five films →'}
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
                ★ RANKED BY {roomMembers.length > 1 ? 'CONSENSUS HARMONY SCORE' : 'TASTE MATCH'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {results.map(film => (
                <FilmCard
                  key={film.id}
                  film={film}
                  roomMembers={roomMembers}
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
                {loadingMore ? 'finding more…' : 'show 5 more →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
