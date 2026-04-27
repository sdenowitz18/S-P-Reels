'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { posterUrl } from '@/lib/types'
import Image from 'next/image'

interface Rec {
  id: string
  note: string | null
  created_at: string
  film: { id: string; title: string; year: number | null; poster_path: string | null; director: string | null }
  from_user: { id: string; name: string }
}

export default function RecommendedPage() {
  const router = useRouter()
  const [recs, setRecs] = useState<Rec[]>([])
  const [loading, setLoading] = useState(true)
  const [reacting, setReacting] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/recommendations/inbox')
      .then(r => r.json())
      .then(d => { setRecs(d.recs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const react = async (recId: string, action: 'watched' | 'watching' | 'save') => {
    setReacting(recId)
    await fetch(`/api/recommendations/${recId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setDone(prev => ({ ...prev, [recId]: action }))
    setReacting(null)
  }

  const ACTION_LABEL: Record<string, string> = {
    watched: '✓ marked as watched',
    watching: '▶ added to now playing',
    save: '+ saved to watch list',
  }

  return (
    <AppShell active="recommended">
      <div style={{ padding: '56px 64px', maxWidth: 860, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ RECOMMENDED</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>
          films your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--forest)' }}>friends</span> sent you.
        </h1>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 32 }}>loading…</p>
        )}

        {!loading && recs.length === 0 && (
          <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', marginTop: 32, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 520 }}>
            nothing yet — when a friend recommends something it'll appear here.
          </p>
        )}

        <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {recs.map(rec => {
            const poster = posterUrl(rec.film?.poster_path, 'w342')
            const reaction = done[rec.id]
            return (
              <div key={rec.id} style={{
                padding: '24px 28px', background: 'var(--bone)',
                border: '0.5px solid var(--paper-edge)', borderRadius: 14,
                display: 'flex', gap: 22, alignItems: 'flex-start',
              }}>
                {poster && (
                  <div style={{ width: 64, height: 96, borderRadius: 3, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <Image src={poster} alt={rec.film?.title ?? ''} fill style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginBottom: 6 }}>
                    from <strong style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink-2)' }}>{rec.from_user?.name}</strong>
                    {' · '}
                    <button
                      onClick={() => router.push(`/friends/${rec.from_user?.id}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0 }}
                    >
                      view thread →
                    </button>
                  </div>

                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500, lineHeight: 1.2 }}>
                    {rec.film?.title}
                  </div>
                  <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'var(--serif-italic)' }}>
                    {rec.film?.director}{rec.film?.director && rec.film?.year ? ' · ' : ''}{rec.film?.year}
                  </div>

                  {rec.note && (
                    <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.5, fontFamily: 'var(--serif-italic)' }}>
                      "{rec.note}"
                    </p>
                  )}

                  {reaction ? (
                    <div style={{ marginTop: 14, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                      {ACTION_LABEL[reaction]}
                    </div>
                  ) : (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { action: 'watched' as const, label: '✓ already watched' },
                        { action: 'watching' as const, label: '▶ now watching' },
                        { action: 'save' as const, label: '+ save for later' },
                      ].map(({ action, label }) => (
                        <button
                          key={action}
                          onClick={() => react(rec.id, action)}
                          disabled={reacting === rec.id}
                          style={{
                            padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                            fontFamily: 'var(--serif-body)', fontSize: 12,
                            border: '0.5px solid var(--paper-edge)',
                            background: 'var(--paper)',
                            color: 'var(--ink)',
                            opacity: reacting === rec.id ? 0.5 : 1,
                            transition: 'all 120ms',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--ink)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--paper)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink)' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
