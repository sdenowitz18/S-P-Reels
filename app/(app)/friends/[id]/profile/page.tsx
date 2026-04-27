'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'

interface Friend { id: string; name: string; email: string; created_at?: string }
interface Film { id: string; title: string; year: number; poster_path: string | null; director: string | null }
interface Entry { film_id: string; my_stars?: number | null; my_line?: string | null; moods?: string[] | null; film?: Film }

function Poster({ path, title, size = 80 }: { path: string | null; title: string; size?: number }) {
  if (!path) return <div style={{ width: size, height: size * 1.5, background: 'var(--paper-edge)', borderRadius: 5, flexShrink: 0 }} />
  return <Image src={`https://image.tmdb.org/t/p/w154${path}`} alt={title} width={size} height={size * 1.5} style={{ borderRadius: 5, flexShrink: 0, objectFit: 'cover' }} />
}

function Carousel({ title, items, empty }: { title: string; items: Entry[]; empty: string }) {
  return (
    <div style={{ marginBottom: 44 }}>
      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 16 }}>{title} · {items.length}</div>
      {items.length === 0 ? (
        <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>{empty}</p>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
          {items.map(e => e.film && (
            <div key={e.film_id} style={{ flexShrink: 0, width: 90 }}>
              <Poster path={e.film.poster_path} title={e.film.title} size={90} />
              <div style={{ fontSize: 11, lineHeight: 1.3, marginTop: 7, fontFamily: 'var(--serif-body)' }}>{e.film.title}</div>
              {e.my_stars && <div style={{ fontSize: 11, color: 'var(--sun)', marginTop: 2 }}>{'★'.repeat(Math.floor(e.my_stars))}{e.my_stars % 1 ? '½' : ''}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FriendProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friend, setFriend] = useState<Friend | null>(null)
  const [watched, setWatched] = useState<Entry[]>([])
  const [watchlist, setWatchlist] = useState<Entry[]>([])
  const [nowPlaying, setNowPlaying] = useState<Entry[]>([])
  const [tasteTags, setTasteTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [friendId, setFriendId] = useState('')

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      const res = await fetch(`/api/friends/${id}/profile`)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      setFriend(data.friend)
      setWatched(data.watched ?? [])
      setWatchlist(data.watchlist ?? [])
      setNowPlaying(data.nowPlaying ?? [])
      setTasteTags(data.tasteTags ?? [])
      setLoading(false)
    })
  }, [params])

  const joined = friend?.created_at ? new Date(friend.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null

  return (
    <AppShell active="friends">
      <div style={{ padding: '40px 64px 96px', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0, marginBottom: 28 }}>
          ← back
        </button>

        {loading ? (
          <div style={{ height: 120, background: 'var(--paper-2)', borderRadius: 14, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : friend ? (
          <>
            {/* Profile header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--p-ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 600, flexShrink: 0 }}>
                {friend.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ PROFILE</div>
                <h1 className="t-display" style={{ fontSize: 38, lineHeight: 1, margin: '6px 0 4px' }}>{friend.name}</h1>
                <div style={{ display: 'flex', gap: 20 }}>
                  <span className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{watched.length} WATCHED</span>
                  <span className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{watchlist.length} SAVED</span>
                  {joined && <span className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>SINCE {joined.toUpperCase()}</span>}
                </div>
              </div>
            </div>

            {/* Taste tags */}
            {tasteTags.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>★ THEIR TASTE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tasteTags.map(t => (
                    <span key={t} style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--p-tint)', color: 'var(--p-ink)', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.04em', border: '0.5px solid var(--p-ink)40' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {nowPlaying.length > 0 && <Carousel title="★ NOW WATCHING" items={nowPlaying} empty="" />}
            <Carousel title="★ WATCHED" items={watched} empty="nothing logged yet." />
            <Carousel title="★ WATCH LIST" items={watchlist} empty="nothing saved yet." />
          </>
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>profile not found.</p>
        )}
      </div>
    </AppShell>
  )
}
