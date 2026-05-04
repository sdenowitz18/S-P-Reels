'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, posterUrl } from '@/lib/types'
import Image from 'next/image'

function StageCard({ tag, title, sub, tint, ink, onClick, wide }: {
  tag: string; title: string; sub: string
  tint: string; ink: string; onClick: () => void; wide?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', padding: '24px 26px',
      background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)',
      borderRadius: 12, transition: 'all 180ms',
      gridColumn: wide ? '1 / -1' : undefined,
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = tint; (e.currentTarget as HTMLButtonElement).style.borderColor = ink }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)' }}
    >
      <div className="t-meta" style={{ fontSize: 10, color: ink }}>{tag}</div>
      <div className="t-headline" style={{ fontSize: 24, marginTop: 8, fontFamily: 'var(--serif-display)', fontWeight: 500 }}>{title}</div>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.55, fontStyle: 'italic', fontFamily: 'var(--serif-italic)' }}>{sub}</p>
    </button>
  )
}

export default function StagePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [film, setFilm] = useState<TMDBSearchResult | null>(null)
  const [slug, setSlug] = useState('')

  useEffect(() => {
    params.then(p => setSlug(p.slug))
    try { setFilm(JSON.parse(sessionStorage.getItem('sp_film') || '{}')) } catch {}
  }, [params])

  const choose = (flow: 'now-playing' | 'rate' | 'reflect') => {
    // Fire-and-forget enrichment so the insight card has data when they finish
    if (film?.id) {
      fetch(`/api/films/${film.id}/enrich`, { method: 'POST' }).catch(() => {})
    }

    if (flow === 'now-playing') {
      sessionStorage.setItem('sp_status', 'now-playing')
      sessionStorage.removeItem('sp_flow')
      router.push(`/add/${slug}/done`)
    } else {
      sessionStorage.setItem('sp_status', 'finished')
      sessionStorage.setItem('sp_flow', flow)
      router.push(`/add/${slug}/${flow === 'reflect' ? 'interview' : 'rate'}`)
    }
  }

  const poster = film ? posterUrl(film.poster_path, 'w342') : null

  return (
    <AppShell active="movies">
      <div style={{ padding: '14px 36px 0', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push('/add')} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)',
        }}>← back to search</button>
      </div>

      <div style={{ padding: '56px 64px', maxWidth: 880, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ STEP 2 · WHERE ARE YOU WITH IT?</div>

        {film && (
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ width: 84, height: 126, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)' }}>
              {poster
                ? <Image src={poster} alt={film.title} width={84} height={126} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                : <div className="poster-ph" style={{ width: '100%', height: '100%' }} />
              }
            </div>
            <div>
              <h1 className="t-display" style={{ fontSize: 48, lineHeight: 1, margin: 0 }}>{film.title}</h1>
              <div style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', marginTop: 6, fontFamily: 'var(--serif-italic)' }}>
                {film.director ? `${film.director} · ` : ''}{film.year}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <StageCard
            tag="◐ STILL WATCHING"
            title="i'm currently watching it"
            sub="we'll add it to now playing so you can drop notes while it's rolling."
            tint="var(--p-tint)" ink="var(--p-ink)"
            onClick={() => choose('now-playing')}
          />
          <StageCard
            tag="● FINISHED"
            title="rate it"
            sub="rate it, log how rewatchable it is, and see how it fits your taste."
            tint="var(--s-tint)" ink="var(--s-ink)"
            onClick={() => choose('rate')}
          />
        </div>
      </div>
    </AppShell>
  )
}
