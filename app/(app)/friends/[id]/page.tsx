'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { BlendRadar } from '@/components/blend-radar'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

interface Film { id: string; title: string; year: number; poster_path: string | null; director: string | null }
interface Entry { my_stars?: number | null; my_line?: string | null; moods?: string[] | null }
interface Crossover { film: Film; me: Entry; them: Entry }
interface Friend { id: string; name: string; email: string }
interface Comment { id: string; text: string; created_at: string; user: { id: string; name: string } }
interface Rec {
  id: string; film: Film; note?: string; created_at: string; isFromMe: boolean
  from_user: { id: string; name: string }; to_user: { id: string; name: string }
  comments: Comment[]
}

type Tab = 'thread' | 'watched' | 'watching' | 'want'

const PROSE_BITS: Record<keyof TasteDimensions, { pos: string; neg: string }> = {
  pace:         { pos: 'slow-burn, atmospheric storytelling', neg: 'kinetic, propulsive cinema' },
  story_engine: { pos: 'tightly-plotted narratives',         neg: 'character study and interiority' },
  tone:         { pos: 'dark, weighty films',                neg: 'lighter, comedic fare' },
  warmth:       { pos: 'emotional warmth and tenderness',    neg: 'cool, detached observation' },
  complexity:   { pos: 'demanding, layered films',           neg: 'accessible, crowd-pleasing stories' },
  style:        { pos: 'expressive, visually distinct work', neg: 'restrained, economical filmmaking' },
}

function shortProse(name: string, dims: TasteDimensions): string {
  const firstName = name.split(' ')[0]
  const sorted = (Object.entries(dims) as [keyof TasteDimensions, number][])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .filter(([, v]) => Math.abs(v) > 0.15)
  if (sorted.length === 0) return `${firstName} has wide-ranging, eclectic taste.`
  const [k1, v1] = sorted[0]
  const desc1 = v1 >= 0 ? PROSE_BITS[k1].pos : PROSE_BITS[k1].neg
  if (sorted.length < 2) return `${firstName} gravitates toward ${desc1}.`
  const [k2, v2] = sorted[1]
  const desc2 = v2 >= 0 ? PROSE_BITS[k2].pos : PROSE_BITS[k2].neg
  return `${firstName} gravitates toward ${desc1}, with a pull toward ${desc2}.`
}

function Stars({ val }: { val?: number | null }) {
  if (!val) return <span style={{ color: 'var(--ink-4)', fontSize: 11, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>no rating</span>
  return <span style={{ color: 'var(--sun)', fontSize: 13 }}>{'★'.repeat(Math.floor(val))}{val % 1 ? '½' : ''}</span>
}

function Poster({ path, title, size = 60 }: { path: string | null; title: string; size?: number }) {
  if (!path) return <div style={{ width: size, height: size * 1.5, background: 'var(--paper-edge)', borderRadius: 4, flexShrink: 0 }} />
  return <Image src={`https://image.tmdb.org/t/p/w92${path}`} alt={title} width={size} height={Math.round(size * 1.5)} style={{ borderRadius: 4, flexShrink: 0, objectFit: 'cover' }} />
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div style={{ padding: '28px 24px', background: 'var(--paper-2)', border: '0.5px dashed var(--paper-edge)', borderRadius: 12 }}>
      <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: 0, fontFamily: 'var(--serif-italic)', lineHeight: 1.55 }}>{copy}</p>
    </div>
  )
}

function RecCard({ rec, onComment, onReact }: {
  rec: Rec
  onComment: (recId: string, text: string) => Promise<void>
  onReact: (recId: string, action: string) => Promise<void>
}) {
  const [commentText, setCommentText] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reacted, setReacted] = useState<string | null>(null)

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    await onComment(rec.id, commentText.trim())
    setCommentText('')
    setSubmitting(false)
  }

  const react = async (action: string) => {
    setReacted(action)
    await onReact(rec.id, action)
  }

  const sender = rec.isFromMe ? 'you' : rec.from_user.name

  return (
    <div style={{ padding: '20px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Poster path={rec.film?.poster_path} title={rec.film?.title} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500 }}>{rec.film?.title}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>
            {[rec.film?.director, rec.film?.year].filter(Boolean).join(' · ')}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-2)' }}>
            <span style={{ fontWeight: 600 }}>{sender}</span>
            {rec.isFromMe ? ` → ${rec.to_user.name}` : ' recommended this'}
          </div>
          {rec.note && (
            <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>"{rec.note}"</p>
          )}
        </div>
      </div>

      {!rec.isFromMe && (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { action: 'watched', label: '✓ already watched' },
            { action: 'watching', label: '▶ am watching' },
            { action: 'save', label: '+ save for later' },
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
        {rec.comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {(showComments ? rec.comments : rec.comments.slice(-2)).map(c => (
              <div key={c.id} style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--serif-display)' }}>{c.user.name} </span>
                <span style={{ color: 'var(--ink-2)' }}>{c.text}</span>
              </div>
            ))}
            {rec.comments.length > 2 && !showComments && (
              <button onClick={() => setShowComments(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', textAlign: 'left' }}>
                view all {rec.comments.length} comments
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
          <button onClick={submitComment} disabled={!commentText.trim() || submitting} className="btn" style={{ padding: '7px 14px', fontSize: 12, borderRadius: 999, opacity: !commentText.trim() ? 0.4 : 1 }}>→</button>
        </div>
      </div>
    </div>
  )
}

function BothRow({ film, me, them, friendName }: { film: Film; me: Entry; them: Entry; friendName: string }) {
  return (
    <div style={{ padding: '18px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, display: 'grid', gridTemplateColumns: '60px 1fr', gap: 18 }}>
      <Poster path={film.poster_path} title={film.title} size={60} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--serif-display)', fontSize: 18, fontWeight: 500 }}>{film.title}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', fontFamily: 'var(--serif-italic)', marginBottom: 14, marginTop: 2 }}>{[film.director, film.year].filter(Boolean).join(' · ')}</div>
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

// Recommend overlay — film search + note
function RecommendOverlay({ friendId, friendName, onClose, onSent }: { friendId: string; friendName: string; onClose: () => void; onSent: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Film[]>([])
  const [selected, setSelected] = useState<Film | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
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
    await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: friendId, filmId: selected.id, note }),
    })
    setSending(false)
    onSent()
    onClose()
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
              {results.slice(0, 6).map((f: any) => (
                <button key={f.id} onClick={() => setSelected(f)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                  {f.poster_path
                    ? <Image src={`https://image.tmdb.org/t/p/w92${f.poster_path}`} alt={f.title} width={32} height={48} style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 48, background: 'var(--paper-edge)', borderRadius: 3, flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500 }}>{f.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{f.year ?? f.release_date?.slice(0, 4)}</div>
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

export default function FriendBlendPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friendId, setFriendId] = useState('')
  const [friend, setFriend] = useState<Friend | null>(null)
  const [myName, setMyName] = useState('')
  const [bothWatched, setBothWatched] = useState<Crossover[]>([])
  const [bothWatching, setBothWatching] = useState<Crossover[]>([])
  const [bothWant, setBothWant] = useState<Crossover[]>([])
  const [sharedTastes, setSharedTastes] = useState<string[]>([])
  const [prompt, setPrompt] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('thread')
  const [thread, setThread] = useState<Rec[]>([])
  const [loadingBlend, setLoadingBlend] = useState(true)
  const [loadingThread, setLoadingThread] = useState(true)
  const [showRecommend, setShowRecommend] = useState(false)
  const [myDimensions, setMyDimensions] = useState<TasteDimensions | null>(null)
  const [theirDimensions, setTheirDimensions] = useState<TasteDimensions | null>(null)

  const loadBlend = async (id: string) => {
    const res = await fetch(`/api/friends/${id}/crossovers`)
    if (!res.ok) { setLoadingBlend(false); return }
    const data = await res.json()
    setFriend(data.friend)
    setMyName(data.myName ?? 'you')
    setBothWatched(data.bothWatched ?? [])
    setBothWatching(data.bothWatching ?? [])
    setBothWant(data.bothWant ?? [])
    setSharedTastes(data.sharedTastes ?? [])
    setPrompt(data.prompt)
    setLoadingBlend(false)
  }

  const loadThread = async (id: string) => {
    const res = await fetch(`/api/friends/${id}/thread`)
    if (!res.ok) { setLoadingThread(false); return }
    const data = await res.json()
    setThread(data.thread ?? [])
    setLoadingThread(false)
  }

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      loadBlend(id)
      loadThread(id)
      const [myTaste, theirTaste] = await Promise.all([
        fetch('/api/profile/taste').then(r => r.json()),
        fetch(`/api/friends/${id}/taste`).then(r => r.json()),
      ])
      if (myTaste?.dimensions) setMyDimensions(myTaste.dimensions)
      if (myTaste?.myName) setMyName(n => n || myTaste.myName)
      if (theirTaste?.dimensions) setTheirDimensions(theirTaste.dimensions)
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
      setThread(prev => prev.map(r => r.id === recId ? { ...r, comments: [...r.comments, comment] } : r))
    }
  }

  const handleReact = async (recId: string, action: string) => {
    await fetch(`/api/recommendations/${recId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
  }

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'thread', label: 'thread', count: thread.length },
    { id: 'watched', label: 'both watched', count: bothWatched.length },
    { id: 'watching', label: 'both watching', count: bothWatching.length },
    { id: 'want', label: 'both want', count: bothWant.length },
  ]

  const loading = loadingBlend

  return (
    <AppShell active="friends">
      {showRecommend && friend && (
        <RecommendOverlay
          friendId={friendId}
          friendName={friend.name}
          onClose={() => setShowRecommend(false)}
          onSent={() => loadThread(friendId)}
        />
      )}

      <div style={{ padding: '40px 64px 96px', maxWidth: 1080, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0, marginBottom: 28 }}>
          ← all friends
        </button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ height: 140, background: 'var(--paper-2)', borderRadius: 18, animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : friend ? (
          <>
            {/* ── Blended taste header ──────────────────────────────────── */}
            <div style={{
              padding: '36px 32px',
              background: 'linear-gradient(105deg, var(--s-tint) 0%, var(--bone) 48%, var(--p-tint) 100%)',
              border: '0.5px solid var(--paper-edge)', borderRadius: 18,
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 32,
              alignItems: 'center',
            }}>
              {/* Me */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--s-ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, flexShrink: 0 }}>
                    {myName[0]?.toUpperCase() ?? 'Y'}
                  </div>
                  <div>
                    <div className="t-meta" style={{ fontSize: 8, color: 'var(--s-ink)', letterSpacing: '0.12em' }}>YOU</div>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, marginTop: 2 }}>{myName}</div>
                  </div>
                </div>
                {myDimensions && (
                  <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                    {shortProse(myName, myDimensions)}
                  </p>
                )}
              </div>

              {/* Center: Radar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                {myDimensions && theirDimensions ? (
                  <BlendRadar
                    myDimensions={myDimensions}
                    theirDimensions={theirDimensions}
                    myName={myName.split(' ')[0]}
                    theirName={friend.name.split(' ')[0]}
                  />
                ) : (
                  <div style={{ width: 320, height: 310, background: 'var(--paper-2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
                  </div>
                )}
                <button
                  onClick={() => router.push(`/friends/${friendId}/compatibility`)}
                  style={{
                    background: 'none',
                    border: '0.5px solid var(--ink-3)',
                    borderRadius: 999,
                    padding: '7px 18px',
                    cursor: 'pointer',
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--ink-3)',
                    letterSpacing: '0.08em',
                    transition: 'all 120ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink)'; e.currentTarget.style.color = 'var(--ink)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink-3)' }}
                >
                  EXPLORE COMPATIBILITY →
                </button>
              </div>

              {/* Them */}
              <div style={{ textAlign: 'right' }}>
                <button
                  onClick={() => router.push(`/friends/${friendId}/profile`)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="t-meta" style={{ fontSize: 8, color: 'var(--p-ink)', letterSpacing: '0.12em' }}>THEIR PROFILE →</div>
                      <div style={{ fontFamily: 'var(--serif-display)', fontSize: 20, fontWeight: 500, marginTop: 2 }}>{friend.name}</div>
                    </div>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--p-ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 600, flexShrink: 0 }}>
                      {friend.name[0]?.toUpperCase()}
                    </div>
                  </div>
                </button>
                {theirDimensions && (
                  <p style={{ margin: 0, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                    {shortProse(friend.name, theirDimensions)}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs */}
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
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: tab === t.id ? 'var(--ink-2)' : 'var(--ink-4)' }}>{t.count}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              {tab === 'thread' && (
                loadingThread ? (
                  <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading thread…</p>
                ) : thread.length === 0 ? (
                  <EmptyState copy={`send ${friend.name.toLowerCase()} a film and the thread starts. their replies will land here.`} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {thread.map(rec => <RecCard key={rec.id} rec={rec} onComment={handleComment} onReact={handleReact} />)}
                  </div>
                )
              )}
              {tab === 'watched' && (
                bothWatched.length === 0
                  ? <EmptyState copy="no overlap yet — once you both log the same film, it lands here." />
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {bothWatched.map(c => <BothRow key={c.film.id} {...c} friendName={friend.name} />)}
                    </div>
              )}
              {tab === 'watching' && <PosterGrid items={bothWatching} emptyText="no shared reels rolling right now." />}
              {tab === 'want' && <PosterGrid items={bothWant} emptyText="nothing on both of your watch lists yet." />}
            </div>
          </>
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>friend not found.</p>
        )}
      </div>
    </AppShell>
  )
}
