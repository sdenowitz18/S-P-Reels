'use client'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteCode, compareTaskCodes, CompatEntry } from '@/lib/taste-code'
import { LetterLoader } from '@/components/letter-loader'

// ── Types ─────────────────────────────────────────────────────────────────────

type ActivityType = 'watch' | 'watchlist' | 'now_playing' | 'rec'
interface ActivityItem {
  id: string
  type: ActivityType
  isMe: boolean
  userName: string
  userId: string
  film: { id: string; title: string; year: number | null; poster_path: string | null; director: string | null }
  stars: number | null
  line: string | null
  note: string | null
  date: string
  recId: string | null
  toUserName: string | null
  comments: { id: string; text: string; created_at: string; user: { id: string; name: string } }[]
}

interface Film { id: string; title: string; year: number; poster_path: string | null; director: string | null }
interface Entry { my_stars?: number | null; my_line?: string | null; moods?: string[] | null }
interface Crossover { film: Film; me: Entry; them: Entry }
interface Friend { id: string; name: string; email: string }

interface GenreEntry { label: string; score: number; count: number; avgRating: number | null }
interface LibraryFilm {
  entry_id?: string; film_id: string; title: string; year: number | null; poster_path: string | null
  director: string | null; genres: string[]; cast: string[]; my_stars: number | null
}

type Tab = 'thread' | 'watched' | 'watching' | 'want'
type ActivityFilter = 'both' | 'me' | 'them'
type WatchedFilter = 'loved' | 'hated' | 'agreed' | 'disagreed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Stars({ val }: { val?: number | null }) {
  if (!val) return <span style={{ color: 'var(--ink-4)', fontSize: 11, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>no rating</span>
  return <span style={{ color: 'var(--sun)', fontSize: 13 }}>{'★'.repeat(Math.floor(val))}{val % 1 ? '½' : ''}</span>
}

function Poster({ path, title, size = 60 }: { path: string | null; title: string; size?: number }) {
  if (!path) return <div style={{ width: size, height: size * 1.5, background: 'var(--paper-edge)', borderRadius: 4, flexShrink: 0 }} />
  // poster_path may be a full URL (activity items) or a raw TMDB path (crossovers)
  const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/w185${path}`
  return <Image src={src} alt={title} width={size} height={Math.round(size * 1.5)} style={{ borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div style={{ padding: '28px 24px', background: 'var(--paper-2)', border: '0.5px dashed var(--paper-edge)', borderRadius: 12 }}>
      <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: 0, fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>{copy}</p>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
        fontFamily: 'var(--mono)', letterSpacing: '0.06em',
        background: active ? 'var(--ink)' : 'var(--paper-2)',
        color: active ? 'var(--paper)' : 'var(--ink-3)',
        border: '0.5px solid var(--paper-edge)',
        transition: 'all 100ms',
      }}
    >
      {children}
    </button>
  )
}

// ── Activity Row (watch / watchlist / now_playing) ────────────────────────────

function ActivityRow({ item, myColor, theirColor }: { item: ActivityItem; myColor: string; theirColor: string }) {
  const color = item.isMe ? myColor : theirColor
  const actionText =
    item.type === 'watch'       ? 'watched' :
    item.type === 'watchlist'   ? 'added to watchlist' :
    'started watching'

  return (
    <div style={{ padding: '16px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: color, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 600,
        }}>
          {item.userName[0]?.toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Who / action */}
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
              {item.isMe ? 'you' : item.userName.split(' ')[0]}
            </span>
            {' '}
            <span style={{ color: 'var(--ink-3)' }}>{actionText}</span>
          </div>

          {/* Film card */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Poster path={item.film.poster_path} title={item.film.title} size={44} />
            <div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500 }}>{item.film.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)', marginTop: 1 }}>
                {[item.film.director, item.film.year].filter(Boolean).join(' · ')}
              </div>
              {item.stars != null && <div style={{ marginTop: 5 }}><Stars val={item.stars} /></div>}
              {item.line && (
                <p style={{ margin: '5px 0 0', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
                  "{item.line}"
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
            {relativeTime(item.date)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Rec Activity Card ─────────────────────────────────────────────────────────

function RecActivityCard({ item, onComment, onReact, myColor, theirColor }: {
  item: ActivityItem
  onComment: (recId: string, text: string) => Promise<void>
  onReact: (recId: string, action: string) => Promise<void>
  myColor: string
  theirColor: string
}) {
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reacted, setReacted] = useState<string | null>(null)
  const recId = item.recId!
  const color = item.isMe ? myColor : theirColor

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    await onComment(recId, commentText.trim())
    setCommentText('')
    setSubmitting(false)
  }

  const react = async (action: string) => {
    setReacted(action)
    await onReact(recId, action)
  }

  return (
    <div style={{ padding: '20px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Poster path={item.film.poster_path} title={item.film.title} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500 }}>{item.film.title}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>
            {[item.film.director, item.film.year].filter(Boolean).join(' · ')}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{item.isMe ? 'you' : item.userName.split(' ')[0]}</span>
            <span style={{ color: 'var(--ink-4)' }}>recommended to</span>
            <span>{item.isMe ? (item.toUserName ?? 'them') : 'you'}</span>
          </div>
          {item.note && (
            <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>"{item.note}"</p>
          )}
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
            {relativeTime(item.date)}
          </div>
        </div>
      </div>

      {!item.isMe && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { action: 'watched',  label: '✓ already watched' },
            { action: 'watching', label: '▶ am watching' },
            { action: 'save',     label: '+ save for later' },
          ].map(({ action, label }) => (
            <button
              key={action}
              onClick={() => react(action)}
              style={{
                padding: '6px 13px', fontSize: 11, borderRadius: 999, cursor: 'pointer',
                background: reacted === action ? 'var(--ink)' : 'var(--bone)',
                color: reacted === action ? 'var(--paper)' : 'var(--ink-2)',
                border: '0.5px solid var(--paper-edge)',
                fontFamily: 'var(--serif-body)',
              }}
            >{label}</button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, borderTop: '0.5px solid var(--paper-edge)', paddingTop: 12 }}>
        {item.comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {(showComments ? item.comments : item.comments.slice(-2)).map(c => (
              <div key={c.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--serif-display)' }}>{c.user.name} </span>
                <span style={{ color: 'var(--ink-2)' }}>{c.text}</span>
              </div>
            ))}
            {item.comments.length > 2 && !showComments && (
              <button
                onClick={() => setShowComments(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', textAlign: 'left' }}
              >
                view all {item.comments.length} comments
              </button>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitComment() }}
            placeholder="add a comment…"
            style={{ flex: 1, padding: '7px 11px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 6, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', outline: 'none' }}
          />
          <button
            onClick={submitComment}
            disabled={!commentText.trim() || submitting}
            className="btn"
            style={{ padding: '7px 14px', fontSize: 12, borderRadius: 999, opacity: !commentText.trim() ? 0.4 : 1 }}
          >→</button>
        </div>
      </div>
    </div>
  )
}

// ── Both Watched Row ──────────────────────────────────────────────────────────

function BothRow({ film, me, them, friendName, showGap }: {
  film: Film; me: Entry; them: Entry; friendName: string; showGap?: boolean
}) {
  const gap = me.my_stars != null && them.my_stars != null
    ? Math.abs(me.my_stars - them.my_stars)
    : null

  return (
    <div style={{ padding: '18px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, display: 'grid', gridTemplateColumns: '60px 1fr', gap: 18 }}>
      <Poster path={film.poster_path} title={film.title} size={60} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 500 }}>{film.title}</div>
          {showGap && gap != null && gap > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', flexShrink: 0 }}>
              Δ {gap.toFixed(1)}★
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)', marginBottom: 14, marginTop: 2 }}>
          {[film.director, film.year].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 6 }}>★ YOU</div>
            <Stars val={me?.my_stars} />
            {me?.my_line && <p style={{ margin: '5px 0 0', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>"{me.my_line}"</p>}
          </div>
          <div style={{ borderLeft: '0.5px solid var(--paper-edge)', paddingLeft: 16 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 6 }}>{friendName.toUpperCase()}</div>
            <Stars val={them?.my_stars} />
            {them?.my_line && <p style={{ margin: '5px 0 0', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>"{them.my_line}"</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function PosterGrid({ items, emptyText }: { items: Crossover[]; emptyText: string }) {
  if (!items.length) return <EmptyState copy={emptyText} />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '28px 16px' }}>
      {items.map(({ film }) => (
        <div key={film.id}>
          <Poster path={film.poster_path} title={film.title} size={110} />
          <div style={{ fontSize: 11, lineHeight: 1.3, marginTop: 8, fontFamily: 'var(--serif-body)' }}>{film.title}</div>
        </div>
      ))}
    </div>
  )
}

// ── Recommend Overlay ─────────────────────────────────────────────────────────

function RecommendOverlay({ friendId, friendName, onClose, onSent }: {
  friendId: string; friendName: string; onClose: () => void; onSent: () => void
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Film[]>([])
  const [selected, setSelected] = useState<Film | null>(null)
  const [note, setNote]         = useState('')
  const [sending, setSending]   = useState(false)
  const [searching, setSearching] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = (q: string) => {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      const res = await fetch(`/api/films/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : (data.results ?? []))
      setSearching(false)
    }, 350)
  }

  const send = async () => {
    if (!selected || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: friendId, filmId: String(selected.id), note }),
      })
      if (!res.ok) return
      onSent()
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,18,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 16, maxWidth: 520, width: '100%', padding: '32px 36px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>★ RECOMMEND TO {friendName.toUpperCase()}</div>
        <h2 className="t-display" style={{ fontSize: 26, margin: '0 0 22px' }}>pick a film</h2>

        {!selected ? (
          <>
            <input
              autoFocus
              value={query}
              onChange={e => search(e.target.value)}
              placeholder="search for a film…"
              style={{ width: '100%', padding: '11px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
            />
            {searching && <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 12, fontFamily: 'var(--serif-italic)' }}>searching…</p>}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.slice(0, 6).map((f: Film & { release_date?: string }) => (
                <button key={f.id} onClick={() => setSelected(f)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                  {f.poster_path
                    ? <Image src={`https://image.tmdb.org/t/p/w92${f.poster_path}`} alt={f.title} width={32} height={48} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 48, background: 'var(--paper-edge)', borderRadius: 3, flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{f.year ?? (f.release_date?.slice(0, 4))}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, marginBottom: 20 }}>
              <Poster path={selected.poster_path} title={selected.title} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500 }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{selected.year}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}>×</button>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={`why should ${friendName} watch this?`}
              rows={3}
              style={{ width: '100%', padding: '11px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink)', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button onClick={send} disabled={sending} className="btn" style={{ padding: '11px 20px', fontSize: 13, borderRadius: 999 }}>
                {sending ? 'sending…' : `send to ${friendName} →`}
              </button>
              <button onClick={onClose} className="btn btn-soft" style={{ padding: '11px 16px', fontSize: 13, borderRadius: 999 }}>cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FriendBlendPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friendId, setFriendId]         = useState('')
  const [friend, setFriend]             = useState<Friend | null>(null)
  const [myName, setMyName]             = useState('')
  const [bothWatched, setBothWatched]   = useState<Crossover[]>([])
  const [bothWatching, setBothWatching] = useState<Crossover[]>([])
  const [bothWant, setBothWant]         = useState<Crossover[]>([])
  const [tab, setTab]                   = useState<Tab>('thread')
  const [activity, setActivity]         = useState<ActivityItem[]>([])
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('both')
  const [watchedFilter, setWatchedFilter]   = useState<WatchedFilter>('loved')
  const [loadingBlend, setLoadingBlend]     = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [showRecommend, setShowRecommend]   = useState(false)
  const [myTasteCode, setMyTasteCode]       = useState<TasteCode | null>(null)
  const [theirTasteCode, setTheirTasteCode] = useState<TasteCode | null>(null)
  const [myGenres, setMyGenres]             = useState<GenreEntry[]>([])
  const [theirGenres, setTheirGenres]       = useState<GenreEntry[]>([])
  const [removingFriend, setRemovingFriend] = useState<'idle' | 'confirm' | 'loading'>('idle')

  const MY_COLOR    = 'var(--s-ink)'
  const THEIR_COLOR = 'var(--p-ink)'

  const loadBlend = async (id: string) => {
    const res = await fetch(`/api/friends/${id}/crossovers`)
    if (!res.ok) { setLoadingBlend(false); return }
    const data = await res.json()
    setFriend(data.friend)
    setMyName(data.myName ?? 'you')
    setBothWatched(data.bothWatched ?? [])
    setBothWatching(data.bothWatching ?? [])
    setBothWant(data.bothWant ?? [])
    setLoadingBlend(false)
  }

  const handleRemoveFriend = async () => {
    if (removingFriend === 'idle') { setRemovingFriend('confirm'); return }
    if (removingFriend !== 'confirm') return
    setRemovingFriend('loading')
    await fetch(`/api/friends/${friendId}/remove`, { method: 'DELETE' })
    router.replace('/friends')
  }

  const loadActivity = async (id: string) => {
    const res = await fetch(`/api/friends/${id}/activity`)
    if (!res.ok) { setLoadingActivity(false); return }
    const data = await res.json()
    setActivity(data.items ?? [])
    setLoadingActivity(false)
  }

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      loadBlend(id)
      loadActivity(id)
      const [myTaste, theirTaste] = await Promise.all([
        fetch('/api/profile/taste').then(r => r.json()),
        fetch(`/api/friends/${id}/taste`).then(r => r.json()),
      ])
      if (myTaste?.tasteCode)      setMyTasteCode(myTaste.tasteCode)
      if (myTaste?.simpleGenres)   setMyGenres(myTaste.simpleGenres)
      if (myTaste?.myName)         setMyName(n => n || myTaste.myName)
      if (theirTaste?.tasteCode)   setTheirTasteCode(theirTaste.tasteCode)
      if (theirTaste?.simpleGenres) setTheirGenres(theirTaste.simpleGenres)
    })
  }, [params])

  const handleComment = async (recId: string, text: string) => {
    const res = await fetch(`/api/recommendations/${recId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.ok) {
      const { comment } = await res.json()
      setActivity(prev => prev.map(item =>
        item.recId === recId ? { ...item, comments: [...item.comments, comment] } : item
      ))
    }
  }

  const handleReact = async (recId: string, action: string) => {
    await fetch(`/api/recommendations/${recId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
  }

  // ── Filtered activity ──────────────────────────────────────────────────────
  const filteredActivity = useMemo(() => {
    if (activityFilter === 'me')   return activity.filter(item => item.isMe)
    if (activityFilter === 'them') return activity.filter(item => !item.isMe)
    return activity
  }, [activity, activityFilter])

  // ── Per-person rating stats (mean + SD from co-watched films) ──────────────
  const ratingStats = useMemo(() => {
    function statsFor(ratings: number[]) {
      if (ratings.length === 0) return { mean: 3, sd: 0.75 }
      const mean = ratings.reduce((s, v) => s + v, 0) / ratings.length
      const sd = ratings.length > 1
        ? Math.sqrt(ratings.reduce((s, v) => s + (v - mean) ** 2, 0) / ratings.length)
        : 0.75
      return { mean, sd: Math.max(sd, 0.25) } // floor SD so thresholds are meaningful
    }
    const myRatings    = bothWatched.map(c => c.me.my_stars).filter((s): s is number => s != null)
    const theirRatings = bothWatched.map(c => c.them.my_stars).filter((s): s is number => s != null)
    return {
      me:   statsFor(myRatings),
      them: statsFor(theirRatings),
    }
  }, [bothWatched])

  // ── Watched filter counts + filtered list ──────────────────────────────────
  const watchedCounts = useMemo(() => {
    const me   = (c: Crossover) => c.me.my_stars  ?? 0
    const them = (c: Crossover) => c.them.my_stars ?? 0
    const bothRated = (c: Crossover) => c.me.my_stars != null && c.them.my_stars != null
    const { me: ms, them: ts } = ratingStats
    return {
      loved:     bothWatched.filter(c => bothRated(c) && me(c) >= ms.mean + ms.sd && them(c) >= ts.mean + ts.sd).length,
      hated:     bothWatched.filter(c => bothRated(c) && me(c) <= ms.mean - ms.sd && them(c) <= ts.mean - ts.sd).length,
      agreed:    bothWatched.filter(c => bothRated(c) && me(c) === them(c)).length,
      disagreed: bothWatched.filter(c => bothRated(c) && Math.abs(me(c) - them(c)) >= 1.5).length,
    }
  }, [bothWatched, ratingStats])

  const filteredWatched = useMemo(() => {
    const me   = (c: Crossover) => c.me.my_stars  ?? 0
    const them = (c: Crossover) => c.them.my_stars ?? 0
    const bothRated = (c: Crossover) => c.me.my_stars != null && c.them.my_stars != null
    const { me: ms, them: ts } = ratingStats

    if (watchedFilter === 'loved') {
      return [...bothWatched]
        .filter(c => bothRated(c) && me(c) >= ms.mean + ms.sd && them(c) >= ts.mean + ts.sd)
        .sort((a, b) => (me(b) + them(b)) - (me(a) + them(a)))
    }
    if (watchedFilter === 'hated') {
      return [...bothWatched]
        .filter(c => bothRated(c) && me(c) <= ms.mean - ms.sd && them(c) <= ts.mean - ts.sd)
        .sort((a, b) => (me(a) + them(a)) - (me(b) + them(b)))
    }
    if (watchedFilter === 'agreed') {
      return [...bothWatched]
        .filter(c => bothRated(c) && me(c) === them(c))
        .sort((a, b) => me(b) - me(a))
    }
    // disagreed — 1.5★ gap
    return [...bothWatched]
      .filter(c => bothRated(c) && Math.abs(me(c) - them(c)) >= 1.5)
      .sort((a, b) => Math.abs(me(b) - them(b)) - Math.abs(me(a) - them(a)))
  }, [bothWatched, watchedFilter, ratingStats])

  // ── Compat + genre memos ───────────────────────────────────────────────────
  const compat = useMemo(() => {
    if (!myTasteCode || !theirTasteCode) return []
    return compareTaskCodes(myTasteCode, theirTasteCode)
  }, [myTasteCode, theirTasteCode])

  const myTop4Genres   = useMemo(() => [...myGenres].filter(g => g.count >= 2 && g.avgRating != null).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 4), [myGenres])
  const theirTop4Genres = useMemo(() => [...theirGenres].filter(g => g.count >= 2 && g.avgRating != null).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0)).slice(0, 4), [theirGenres])
  const myGenreSet   = useMemo(() => new Set(myTop4Genres.map(g => g.label)), [myTop4Genres])
  const theirGenreSet = useMemo(() => new Set(theirTop4Genres.map(g => g.label)), [theirTop4Genres])

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'thread',   label: 'activity',      count: activity.length },
    { id: 'watched',  label: 'both watched',  count: bothWatched.length },
    { id: 'watching', label: 'both watching', count: bothWatching.length },
    { id: 'want',     label: 'both want',     count: bothWant.length },
  ]

  const WATCHED_FILTERS: { id: WatchedFilter; label: string }[] = [
    { id: 'loved',     label: '♥ both loved'     },
    { id: 'hated',     label: '✗ both hated'     },
    { id: 'agreed',    label: '= both agreed'    },
    { id: 'disagreed', label: '≠ both disagreed' },
  ]

  return (
    <AppShell active="friends">
      {showRecommend && friend && (
        <RecommendOverlay
          friendId={friendId}
          friendName={friend.name}
          onClose={() => setShowRecommend(false)}
          onSent={() => loadActivity(friendId)}
        />
      )}

      <div style={{ padding: '40px 64px 96px', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0 }}
          >
            ← all friends
          </button>
          <button
            onClick={handleRemoveFriend}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontStyle: 'italic', fontSize: 11,
              color: removingFriend === 'confirm' ? 'var(--error, #c0392b)' : 'var(--ink-4)',
              fontFamily: 'var(--serif-italic)', padding: 0,
            }}
          >
            {removingFriend === 'loading' ? 'removing…'
              : removingFriend === 'confirm' ? 'confirm remove?'
              : 'remove friend'}
          </button>
        </div>

        {loadingBlend ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <LetterLoader label="loading" />
          </div>
        ) : friend ? (
          <>
            {/* ── Blended taste header ──────────────────────────────────── */}
            <div style={{
              padding: '36px 32px',
              background: 'linear-gradient(105deg, var(--s-tint) 0%, var(--bone) 48%, var(--p-tint) 100%)',
              border: '0.5px solid var(--paper-edge)', borderRadius: 18,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 32, alignItems: 'flex-start' }}>
                {/* Me */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: MY_COLOR, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, flexShrink: 0 }}>
                      {myName[0]?.toUpperCase() ?? 'Y'}
                    </div>
                    <div>
                      <div className="t-meta" style={{ fontSize: 8, color: MY_COLOR, letterSpacing: '0.12em' }}>YOU</div>
                      <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, marginTop: 2 }}>{myName}</div>
                    </div>
                  </div>
                  {myTasteCode && (
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                      {myTasteCode.entries.map(e => {
                        const bucket = compat.find((c: CompatEntry) => c.myEntry?.letter === e.letter)?.bucket ?? 'asymmetric'
                        const borderColor = bucket === 'shared' ? 'var(--forest)' : bucket === 'opposing' ? '#c05040' : 'var(--paper-edge)'
                        const textColor   = bucket === 'asymmetric' ? 'var(--ink-4)' : 'var(--s-ink)'
                        return (
                          <div key={e.letter} style={{ width: 36, height: 36, borderRadius: 6, border: `1.5px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 600, color: textColor }}>{e.letter}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {myTop4Genres.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {myTop4Genres.map(g => (
                        <span key={g.label} style={{
                          fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.05em',
                          padding: '2px 7px', borderRadius: 999,
                          border: `0.5px solid ${theirGenreSet.has(g.label) ? 'var(--forest)' : 'var(--s-ink)'}`,
                          color: theirGenreSet.has(g.label) ? 'var(--forest)' : 'var(--s-ink)',
                          background: theirGenreSet.has(g.label) ? 'rgba(74,107,62,0.08)' : 'transparent',
                        }}>{g.label}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Center vs. */}
                <div style={{ paddingTop: 16, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)' }}>vs.</div>

                {/* Them */}
                <div>
                  <button onClick={() => router.push(`/friends/${friendId}/profile`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end', marginBottom: 16 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div className="t-meta" style={{ fontSize: 8, color: THEIR_COLOR, letterSpacing: '0.12em' }}>THEIR PROFILE →</div>
                        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, marginTop: 2 }}>{friend.name}</div>
                      </div>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: THEIR_COLOR, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, flexShrink: 0 }}>
                        {friend.name[0]?.toUpperCase()}
                      </div>
                    </div>
                  </button>
                  {theirTasteCode && (
                    <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginBottom: 10 }}>
                      {theirTasteCode.entries.map(e => {
                        const bucket = compat.find((c: CompatEntry) => c.theirEntry?.letter === e.letter)?.bucket ?? 'asymmetric'
                        const borderColor = bucket === 'shared' ? 'var(--forest)' : bucket === 'opposing' ? '#c05040' : 'var(--paper-edge)'
                        const textColor   = bucket === 'asymmetric' ? 'var(--ink-4)' : 'var(--p-ink)'
                        return (
                          <div key={e.letter} style={{ width: 36, height: 36, borderRadius: 6, border: `1.5px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 600, color: textColor }}>{e.letter}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {theirTop4Genres.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {theirTop4Genres.map(g => (
                        <span key={g.label} style={{
                          fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.05em',
                          padding: '2px 7px', borderRadius: 999,
                          border: `0.5px solid ${myGenreSet.has(g.label) ? 'var(--forest)' : 'var(--p-ink)'}`,
                          color: myGenreSet.has(g.label) ? 'var(--forest)' : 'var(--p-ink)',
                          background: myGenreSet.has(g.label) ? 'rgba(74,107,62,0.08)' : 'transparent',
                        }}>{g.label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* View compatibility button */}
              <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '0.5px solid var(--paper-edge)' }}>
                <button
                  onClick={() => router.push(`/friends/${friendId}/compatibility`)}
                  style={{
                    padding: '8px 20px', background: 'none', border: '0.5px solid var(--ink-3)',
                    borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9,
                    color: 'var(--ink-3)', letterSpacing: '0.1em', transition: 'all 120ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink-3)' }}
                >
                  VIEW COMPATIBILITY →
                </button>
              </div>
            </div>

            {/* ── Tabs ───────────────────────────────────────────────────── */}
            <div style={{ marginTop: 36, borderBottom: '0.5px solid var(--paper-edge)', display: 'flex', overflowX: 'auto' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: '13px 20px', cursor: 'pointer', background: 'transparent', border: 'none',
                  borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent',
                  fontFamily: 'var(--serif-body)', fontSize: 14,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
                  display: 'inline-flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap',
                }}>
                  {t.label}
                  {t.count !== undefined && (
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: tab === t.id ? 'var(--ink-2)' : 'var(--ink-4)' }}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>

              {/* ── Activity feed ─────────────────────────────────────────── */}
              {tab === 'thread' && (
                <>
                  {/* Filter pill + recommend button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['both', 'me', 'them'] as ActivityFilter[]).map(f => (
                        <FilterPill key={f} active={activityFilter === f} onClick={() => setActivityFilter(f)}>
                          {f === 'me' ? 'YOU' : f === 'them' ? 'THEM' : 'BOTH'}
                        </FilterPill>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowRecommend(true)}
                      className="btn"
                      style={{ padding: '7px 16px', fontSize: 11, borderRadius: 999, fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}
                    >
                      + REC A FILM
                    </button>
                  </div>

                  {loadingActivity ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                      <LetterLoader label="loading" size={64} />
                    </div>
                  ) : filteredActivity.length === 0 ? (
                    <EmptyState copy={
                      activityFilter === 'me'   ? 'no activity from you yet.' :
                      activityFilter === 'them' ? `no activity from ${friend.name.split(' ')[0]} yet.` :
                      `no activity yet — start by recommending ${friend.name.split(' ')[0]} a film.`
                    } />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {filteredActivity.map(item =>
                        item.type === 'rec' ? (
                          <RecActivityCard
                            key={item.id}
                            item={item}
                            onComment={handleComment}
                            onReact={handleReact}
                            myColor={MY_COLOR}
                            theirColor={THEIR_COLOR}
                          />
                        ) : (
                          <ActivityRow
                            key={item.id}
                            item={item}
                            myColor={MY_COLOR}
                            theirColor={THEIR_COLOR}
                          />
                        )
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ── Both watched ──────────────────────────────────────────── */}
              {tab === 'watched' && (
                <>
                  {/* Filter pills */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                    {WATCHED_FILTERS.map(f => (
                      <FilterPill key={f.id} active={watchedFilter === f.id} onClick={() => setWatchedFilter(f.id)}>
                        {f.label}
                        <span style={{ marginLeft: 6, opacity: 0.6 }}>{watchedCounts[f.id]}</span>
                      </FilterPill>
                    ))}
                  </div>

                  {filteredWatched.length === 0 ? (
                    <EmptyState copy={
                      watchedFilter === 'loved'     ? 'no films you both rated above your personal average yet.' :
                      watchedFilter === 'hated'     ? 'no films you both rated below your personal average — a good sign.' :
                      watchedFilter === 'agreed'    ? 'no films with identical ratings yet.' :
                      'no films where you disagreed by 1.5★ or more.'
                    } />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {filteredWatched.map(c => (
                        <BothRow
                          key={c.film.id}
                          {...c}
                          friendName={friend.name}
                          showGap={watchedFilter === 'disagreed'}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === 'watching' && <PosterGrid items={bothWatching} emptyText="no shared reels rolling right now." />}
              {tab === 'want'     && <PosterGrid items={bothWant}     emptyText="nothing on both of your watch lists yet." />}
            </div>
          </>
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>friend not found.</p>
        )}
      </div>
    </AppShell>
  )
}
