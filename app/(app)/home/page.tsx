'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { useIsMobile } from '@/lib/use-is-mobile'
import useSWR from 'swr'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import type { FeedItem } from '@/app/api/friends/feed/route'
import { FilmPanel, type PanelFilm } from '@/app/(app)/films/film-panel'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ResumeSession {
  id:                  string
  path:                string
  contradictions_count: number
  needs_rating:        boolean
  current_step:        number
}

interface Friend { id: string; name: string }

interface Notification {
  id: string
  type: string
  payload: Record<string, string>
  read: boolean
  created_at: string
}

// Assign a stable color to each friend based on their position in the list
const FRIEND_COLORS = [
  { ink: '#c25a2a', tint: '#fdf0e8' },  // --s-ink (rust)
  { ink: '#2f6b82', tint: '#e6f2f7' },  // --p-ink (slate blue)
  { ink: '#4a6b3e', tint: '#eaf2e8' },  // --forest (moss)
  { ink: '#8a5a9a', tint: '#f5eef8' },  // purple
  { ink: '#c25a6b', tint: '#fde8ec' },  // rose
  { ink: '#6b7a2a', tint: '#f2f4e0' },  // olive
]

function friendColor(index: number) {
  return FRIEND_COLORS[index % FRIEND_COLORS.length]
}

function DoorCard({ tag, title, sub, cta, onClick, tint, ink, paper }: {
  tag: string; title: React.ReactNode; sub: string; cta: string
  onClick: () => void; tint: string; ink: string; paper: string
}) {
  return (
    <button
      onClick={onClick}
      className="door-card"
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        padding: '28px 28px 32px',
        background: paper,
        border: '0.5px solid var(--paper-edge)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column', minHeight: 240, gap: 0,
        transition: 'all 180ms',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = tint
        el.style.border = `1px solid ${ink}`
        el.style.boxShadow = '0 14px 32px -18px rgba(40,20,10,.35)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = paper
        el.style.border = '0.5px solid var(--paper-edge)'
        el.style.boxShadow = 'var(--shadow-card)'
      }}
    >
      <div className="t-meta" style={{ fontSize: 10, color: ink }}>★ {tag.toUpperCase()}</div>
      <div className="t-display" style={{ fontSize: 28, marginTop: 14, marginBottom: 14, lineHeight: 1.1 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, flex: 1, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>
        {sub}
      </div>
      <div style={{ marginTop: 22, fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
        {cta}
      </div>
    </button>
  )
}

export default function HomePage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const day = new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()
  const [activeFriend, setActiveFriend] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<'all' | 'watch' | 'rec' | 'watchlist'>('all')
  const [selectedFilm, setSelectedFilm] = useState<PanelFilm | null>(null)
  const [likeState, setLikeState] = useState<Record<string, { count: number; liked: boolean }>>({})

  // Enrich selectedFilm with full panel data when it's first opened
  useEffect(() => {
    if (!selectedFilm) return
    if (selectedFilm.dimBreakdown && selectedFilm.dimBreakdown.length > 0) return
    if (selectedFilm.synopsis != null) return

    let cancelled = false
    fetch(`/api/films/${selectedFilm.id}/panel`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setSelectedFilm(prev =>
          prev?.id === selectedFilm.id ? { ...prev, ...data } : prev
        )
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [selectedFilm?.id])

  const { data: resumeData } = useSWR<{ session: ResumeSession | null }>('/api/onboarding/resume', fetcher)
  const resumeSession = resumeData?.session ?? null

  const { data: feedData } = useSWR<{ friends: Friend[]; items: FeedItem[] }>('/api/friends/feed', fetcher)
  const friends = feedData?.friends ?? []
  const allItems = feedData?.items ?? []

  const { data: notifData, mutate: mutateNotifs } = useSWR<{ notifications: Notification[] }>('/api/notifications', fetcher)
  const notifications = notifData?.notifications ?? []

  // Build a stable color map: friendId → color
  const colorMap = new Map(friends.map((f, i) => [f.id, friendColor(i)]))

  const visibleItems = allItems.filter(item => {
    if (activeFriend && item.userId !== activeFriend) return false
    if (activeType === 'watch') return item.type === 'watch'
    if (activeType === 'rec') return item.type === 'rec'
    if (activeType === 'watchlist') return item.type === 'watchlist' || item.type === 'now_playing'
    return true
  })

  function dismissNotif(id: string) {
    mutateNotifs(
      prev => prev ? { notifications: prev.notifications.filter(n => n.id !== id) } : prev,
      false
    )
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
  }

  function handleNotifClick(notif: Notification) {
    dismissNotif(notif.id)
    if (notif.type === 'friend_accepted') {
      router.push(`/friends/${notif.payload.friendId}/compatibility`)
    } else if (notif.type === 'rec_received') {
      router.push('/films?mode=rec')
    }
  }

  function notifCopy(notif: Notification): string | null {
    if (notif.type === 'friend_accepted') {
      return `${notif.payload.friendName} accepted your friend request. See how your tastes line up →`
    }
    if (notif.type === 'activity_liked') {
      return `${notif.payload.likerName} liked your log of ${notif.payload.filmTitle}`
    }
    if (notif.type === 'rec_received') {
      const name = notif.payload.fromName
      return name ? `${name} sent you a recommendation →` : 'you have a new recommendation →'
    }
    return null
  }

  async function handleLike(item: FeedItem) {
    const current = likeState[item.id] ?? { count: item.reactionCount, liked: item.hasLiked }
    const newLiked = !current.liked
    const newCount = newLiked ? current.count + 1 : Math.max(0, current.count - 1)

    setLikeState(prev => ({ ...prev, [item.id]: { count: newCount, liked: newLiked } }))

    try {
      const res = await fetch(`/api/library/${item.entryId}/react`, {
        method: newLiked ? 'POST' : 'DELETE',
        headers: newLiked ? { 'Content-Type': 'application/json' } : {},
        body: newLiked ? JSON.stringify({ type: 'like' }) : undefined,
      })
      const data = await res.json()
      setLikeState(prev => ({ ...prev, [item.id]: { count: data.count, liked: data.liked } }))
    } catch {
      setLikeState(prev => ({ ...prev, [item.id]: current }))
    }
  }

  return (
    <AppShell active="home">
      <div style={{ padding: isMobile ? '28px 16px 96px' : '56px 64px 80px', maxWidth: 1280, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          ★ {day.toUpperCase()} EVENING · YOUR ROOM
        </div>

        {/* Resume taste setup banner */}
        {resumeSession && (
          <button
            onClick={() => {
              const dest = resumeSession.needs_rating
                ? `/onboarding/rate/${resumeSession.id}`
                : `/onboarding/interview/${resumeSession.id}`
              router.push(dest)
            }}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              marginTop: 20, padding: isMobile ? '14px 16px' : '16px 22px',
              background: 'var(--s-paper)', border: '1px solid var(--s-ink)',
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 12,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--s-tint)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--s-paper)' }}
          >
            <div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--s-ink)', marginBottom: 4 }}>
                ★ TASTE SETUP IN PROGRESS
              </div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                {resumeSession.needs_rating
                  ? 'continue rating films →'
                  : `continue your interview · question ${resumeSession.current_step + 1} of ${resumeSession.contradictions_count} →`}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--s-ink)', whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
              RESUME
            </div>
          </button>
        )}

        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 12 : 22 }}>
          <DoorCard
            tag="01 · log"
            title="log something i've watched"
            sub="a film or show — finished or mid-reel, we'll route it the right way."
            cta="log a film →"
            onClick={() => router.push('/add')}
            tint="var(--sun-tint)" ink="var(--sun)" paper="var(--bone)"
          />
          <DoorCard
            tag="02 · find"
            title="find something to watch"
            sub="the mood room — describe the night, we'll suggest from your taste."
            cta="step inside  →"
            onClick={() => router.push('/mood')}
            tint="var(--s-tint)" ink="var(--s-ink)" paper="var(--s-paper)"
          />
          <DoorCard
            tag="03 · save"
            title="save for later"
            sub="add to the watch list. we'll hold it for the right night."
            cta="put it on the list  →"
            onClick={() => router.push('/watch-list/save')}
            tint="var(--p-tint)" ink="var(--p-ink)" paper="var(--p-paper)"
          />
        </div>

        {/* ── Friends section ──────────────────────────────────────────────── */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '0.5px solid var(--paper-edge)' }}>

          {/* Header row: label + Add Friend button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div className="t-meta" style={{ fontSize: 11, color: 'var(--ink-3)' }}>★ FRIENDS</div>
            <button
              onClick={() => router.push('/friends')}
              style={{
                background: 'none', border: '0.5px solid var(--paper-edge)',
                borderRadius: 999, cursor: 'pointer',
                padding: '5px 14px',
                fontFamily: 'var(--mono)', fontSize: 9,
                letterSpacing: '0.07em', color: 'var(--ink-3)',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
            >
              + ADD FRIEND
            </button>
          </div>

          {friends.length === 0 ? (
            /* No friends yet */
            <div style={{ padding: '24px 22px', background: 'var(--paper-2)', border: '0.5px dashed var(--paper-edge)', borderRadius: 12 }}>
              <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
                add friends and you&apos;ll see what they&apos;re watching here.
              </p>
            </div>
          ) : (
            <>
              {/* Friend filter chips */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  onClick={() => setActiveFriend(null)}
                  style={{
                    padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
                    border: `0.5px solid ${activeFriend === null ? 'var(--ink)' : 'var(--paper-edge)'}`,
                    background: activeFriend === null ? 'var(--ink)' : 'transparent',
                    color: activeFriend === null ? 'var(--paper)' : 'var(--ink-3)',
                    fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em',
                    transition: 'all 120ms',
                  }}
                >
                  ALL
                </button>
                {friends.map((f, i) => {
                  const color = friendColor(i)
                  const isActive = activeFriend === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => setActiveFriend(isActive ? null : f.id)}
                      style={{
                        padding: '5px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `0.5px solid ${isActive ? color.ink : 'var(--paper-edge)'}`,
                        background: isActive ? color.ink : 'transparent',
                        color: isActive ? '#fff' : color.ink,
                        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.07em',
                        transition: 'all 120ms',
                      }}
                    >
                      {f.name.split(' ')[0].toUpperCase()}
                    </button>
                  )
                })}
              </div>

              {/* Type filter chips */}
              {(() => {
                const types: { key: typeof activeType; label: string }[] = [
                  { key: 'all',      label: 'ALL ACTIVITY' },
                  { key: 'watch',    label: 'WATCHED' },
                  { key: 'rec',      label: 'REC\'D TO ME' },
                  { key: 'watchlist', label: 'SAVED' },
                ]
                return (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                    {types.map(({ key, label }) => {
                      const isActive = activeType === key
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveType(key)}
                          style={{
                            padding: '4px 12px', borderRadius: 999, cursor: 'pointer',
                            border: `0.5px solid ${isActive ? 'var(--ink-3)' : 'var(--paper-edge)'}`,
                            background: isActive ? 'var(--paper-2)' : 'transparent',
                            color: isActive ? 'var(--ink)' : 'var(--ink-4)',
                            fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.07em',
                            transition: 'all 120ms',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )
              })()}


              {/* Activity feed */}
              {visibleItems.length === 0 ? (
                <div style={{ padding: '20px 0', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                  nothing logged in the last week.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {visibleItems.slice(0, 20).map(item => {
                    const color = colorMap.get(item.userId) ?? FRIEND_COLORS[0]
                    const ls = likeState[item.id] ?? { count: item.reactionCount, liked: item.hasLiked }
                    const isRec = item.type === 'rec'

                    if (isRec) {
                      return (
                        <div
                          key={item.id}
                          onClick={() => router.push('/films?mode=rec')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 10px',
                            marginBottom: 4,
                            borderRadius: 8,
                            background: color.tint,
                            border: `1px solid ${color.ink}30`,
                            cursor: 'pointer',
                            transition: 'border-color 120ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color.ink}70` }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color.ink}30` }}
                        >
                          {/* Accent bar */}
                          <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: color.ink, flexShrink: 0 }} />

                          {/* Poster */}
                          {item.film.poster_path ? (
                            <div style={{ width: 32, height: 48, borderRadius: 3, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-edge)' }}>
                              <Image src={item.film.poster_path} alt={item.film.title} width={32} height={48} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                            </div>
                          ) : (
                            <div style={{ width: 32, height: 48, borderRadius: 3, background: 'var(--paper-edge)', flexShrink: 0 }} />
                          )}

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: color.ink, fontWeight: 600, letterSpacing: '0.06em' }}>
                                {item.userName.split(' ')[0].toUpperCase()}
                              </span>
                              <span style={{
                                fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.07em',
                                color: color.ink, background: `${color.ink}18`,
                                padding: '2px 6px', borderRadius: 999,
                              }}>→ REC</span>
                            </div>
                            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.film.title}
                              {item.film.year ? <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>{item.film.year}</span> : null}
                            </div>
                            {item.note && (
                              <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                &ldquo;{item.note}&rdquo;
                              </div>
                            )}
                          </div>

                          {/* View CTA */}
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: color.ink, letterSpacing: '0.06em', flexShrink: 0, opacity: 0.7 }}>
                            view →
                          </div>

                          {/* Date */}
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', flexShrink: 0, letterSpacing: '0.03em' }}>
                            {new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedFilm({
                          id:              item.film.id,
                          title:           item.film.title,
                          year:            item.film.year,
                          poster_path:     item.film.poster_path,
                          director:        item.film.director,
                          kind:            'movie',
                          genres:          [],
                          aiGenres:        [],
                          matchScore:      null,
                          tasteScore:      null,
                          compositeQuality: null,
                          libraryStatus:   null,
                        })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0',
                          borderBottom: '0.5px solid var(--paper-edge)',
                          cursor: 'pointer',
                          transition: 'background 120ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'none' }}
                      >
                        {/* Color bar */}
                        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: color.ink, flexShrink: 0 }} />

                        {/* Poster */}
                        {item.film.poster_path ? (
                          <div style={{ width: 32, height: 48, borderRadius: 3, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-edge)' }}>
                            <Image src={item.film.poster_path} alt={item.film.title} width={32} height={48} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                          </div>
                        ) : (
                          <div style={{ width: 32, height: 48, borderRadius: 3, background: 'var(--paper-edge)', flexShrink: 0 }} />
                        )}

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: color.ink, fontWeight: 600, letterSpacing: '0.06em', flexShrink: 0 }}>
                              {item.userName.split(' ')[0].toUpperCase()}
                            </span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}>
                              {item.type === 'watch' ? 'watched' : item.type === 'watchlist' ? 'saved' : 'watching'}
                            </span>
                          </div>
                          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.film.title}
                            {item.film.year ? <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>{item.film.year}</span> : null}
                          </div>
                          {item.line && (
                            <div style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              &ldquo;{item.line}&rdquo;
                            </div>
                          )}
                        </div>

                        {/* Stars */}
                        {item.stars != null && (
                          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 13, color: 'var(--sun)', fontWeight: 600, flexShrink: 0 }}>
                            {item.stars}★
                          </div>
                        )}

                        {/* Like button */}
                        <button
                          onClick={e => { e.stopPropagation(); handleLike(item) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 3,
                            flexShrink: 0, padding: '2px 4px',
                            color: ls.liked ? 'var(--s-ink)' : 'var(--ink-4)',
                            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.04em',
                            transition: 'color 120ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--s-ink)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ls.liked ? 'var(--s-ink)' : 'var(--ink-4)' }}
                        >
                          <span style={{ fontSize: 11 }}>{ls.liked ? '♥' : '♡'}</span>
                          {ls.count > 0 && <span>{ls.count}</span>}
                        </button>

                        {/* Date */}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', flexShrink: 0, letterSpacing: '0.03em' }}>
                          {new Date(item.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedFilm && (
        <FilmPanel
          film={selectedFilm}
          onClose={() => setSelectedFilm(null)}
          onLibraryChange={(filmId, status) =>
            setSelectedFilm(prev => prev?.id === filmId ? { ...prev, libraryStatus: status } : prev)
          }
        />
      )}
    </AppShell>
  )
}
