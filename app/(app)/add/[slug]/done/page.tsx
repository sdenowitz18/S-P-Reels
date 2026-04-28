'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, ReflectionResult, posterUrl } from '@/lib/types'
import { RecommendToFriends } from '@/components/recommend-to-friends'
import Image from 'next/image'

interface SimilarFilm { id: string; title: string; year: number | null; poster_path: string | null }

function TagPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', color: 'var(--ink-2)' }}>
      {label.replace(/-/g, ' ')}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
    </span>
  )
}

function SimilarCard({ film, onAdd }: { film: SimilarFilm; onAdd: (list: 'watchlist' | 'watched') => void }) {
  const poster = posterUrl(film.poster_path, 'w342')
  const [added, setAdded] = useState<'watchlist' | 'watched' | null>(null)
  const handle = (list: 'watchlist' | 'watched') => { setAdded(list); onAdd(list) }
  return (
    <div style={{ flexShrink: 0, width: 148, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ width: 148, height: 222, borderRadius: 6, overflow: 'hidden', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)' }}>
        {poster ? <Image src={poster} alt={film.title} width={148} height={222} style={{ objectFit: 'cover', width: '100%', height: '100%' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>no poster</span></div>}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--serif-body)', fontSize: 13, fontWeight: 500, lineHeight: 1.25, marginBottom: 2 }}>{film.title}</div>
        {film.year && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{film.year}</div>}
      </div>
      {added ? (
        <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>{added === 'watchlist' ? '+ saved' : '✓ logged'}</div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => handle('watchlist')} style={{ flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10.5, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', border: '0.5px solid var(--paper-edge)', color: 'var(--ink-2)' }}>+ save</button>
          <button onClick={() => handle('watched')} style={{ flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer', fontSize: 10.5, fontFamily: 'var(--mono)', letterSpacing: '0.06em', textTransform: 'uppercase', background: 'transparent', border: '0.5px solid var(--paper-edge)', color: 'var(--ink-2)' }}>✓ seen</button>
        </div>
      )}
    </div>
  )
}

export default function DonePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [film, setFilm]         = useState<TMDBSearchResult | null>(null)
  const [status, setStatus]     = useState<'finished' | 'now-playing'>('finished')
  const [reflection, setReflection] = useState<ReflectionResult | null>(null)
  const [likedTags, setLikedTags]   = useState<string[]>([])
  const [dislikedTags, setDislikedTags] = useState<string[]>([])
  const [neutralTags, setNeutralTags]   = useState<string[]>([])
  const [similar, setSimilar]   = useState<SimilarFilm[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    params.then(async p => {
      const filmData: TMDBSearchResult = JSON.parse(sessionStorage.getItem('sp_film') || '{}')
      const st = (sessionStorage.getItem('sp_status') || 'finished') as 'finished' | 'now-playing'
      setFilm(filmData)
      setStatus(st)

      if (st === 'now-playing') {
        await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filmId: filmData.id, list: 'now_playing', audience: ['me'] }) })
        return
      }

      try {
        const rawRef = sessionStorage.getItem('sp_reflection')
        if (rawRef) {
          const parsed = JSON.parse(rawRef)
          setReflection({ taste_tags: parsed.taste_tags ?? [], taste_note: parsed.taste_note ?? '', shifts: parsed.shifts ?? '', similar: parsed.similar ?? [] })
        }
      } catch {}

      try {
        const rawSt = sessionStorage.getItem('sp_sentiment_tags')
        if (rawSt) {
          const parsed = JSON.parse(rawSt) as { liked: string[]; disliked: string[] }
          setLikedTags(parsed.liked ?? [])
          setDislikedTags(parsed.disliked ?? [])
        }
      } catch {}

      if (filmData.id) {
        try {
          const filmRes = await fetch(`/api/films/${filmData.id}`)
          if (filmRes.ok) {
            const fullFilm = await filmRes.json()
            setNeutralTags((fullFilm.keywords ?? []).slice(0, 5))
          }
        } catch {}

        setLoadingSimilar(true)
        try {
          const simRes = await fetch(`/api/films/${filmData.id}/similar`)
          if (simRes.ok) { const d = await simRes.json(); setSimilar(d.similar ?? []) }
        } catch {}
        setLoadingSimilar(false)
      }

      sessionStorage.removeItem('sp_interviewId')
      sessionStorage.removeItem('sp_reflection')
      sessionStorage.removeItem('sp_ai_suggestion')
      sessionStorage.removeItem('sp_sentiment_tags')
      sessionStorage.removeItem('sp_rating')
      sessionStorage.removeItem('sp_persona')
      sessionStorage.removeItem('sp_depth')
      sessionStorage.removeItem('sp_flow')
    })
  }, [params])

  const addToList = (filmId: string, list: 'watchlist' | 'watched') => {
    fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filmId, list, audience: ['me'] }) })
  }

  const poster = film ? posterUrl(film.poster_path, 'w500') : null
  const hasSentiment = likedTags.length > 0 || dislikedTags.length > 0

  if (status === 'now-playing') {
    return (
      <AppShell active="now">
        <div style={{ padding: '80px 64px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="stamp" style={{ display: 'inline-block', marginBottom: 40 }}>rolling</div>
          <h1 className="t-display" style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>{film?.title} is <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>now playing</span>.</h1>
          <p style={{ fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>rolling now — we'll be here when you finish.</p>
          {film && <div style={{ textAlign: 'left' }}><RecommendToFriends filmId={film.id} filmTitle={film.title} onDone={() => router.push('/now-playing')} onSkip={() => router.push('/now-playing')} /></div>}
          <div style={{ marginTop: 24, display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button className="btn" onClick={() => router.push('/now-playing')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>see what's playing →</button>
            <button className="btn btn-soft" onClick={() => router.push('/home')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>back to home</button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell active="movies">
      <div style={{ padding: '56px 0 96px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ padding: '0 64px', display: 'flex', gap: 40, alignItems: 'flex-start' }}>
          {poster && (
            <div style={{ width: 180, height: 270, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '0.5px solid var(--paper-edge)', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
              <Image src={poster} alt={film?.title ?? ''} width={180} height={270} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
            </div>
          )}
          <div style={{ paddingTop: 8 }}>
            <div className="stamp" style={{ display: 'inline-block', marginBottom: 20 }}>watched</div>
            <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, margin: '0 0 10px' }}>{film?.title}</h1>
            <div style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginBottom: 14 }}>{film?.director ? `${film.director} · ` : ''}{film?.year}</div>
            <p style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.55, fontFamily: 'var(--serif-italic)', margin: 0, maxWidth: 520 }}>it's in your watched list. here's what we captured.</p>
          </div>
        </div>

        {/* Taste read */}
        {reflection?.taste_note && (
          <section style={{ margin: '52px 64px 0', padding: '28px 32px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 12 }}>★ WHAT THIS SAYS ABOUT YOUR TASTE</div>
            <p className="t-display" style={{ fontSize: 22, lineHeight: 1.4, margin: '0 0 16px', maxWidth: 680 }}>{reflection.taste_note}</p>
            {reflection.taste_tags.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {reflection.taste_tags.map(t => (
                  <span key={t} style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--sun-tint)', border: '0.5px solid var(--sun)', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t.replace(/-/g, ' ')}</span>
                ))}
              </div>
            )}
            {reflection.shifts && <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', margin: '16px 0 0', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>{reflection.shifts}</p>}
          </section>
        )}

        {/* Liked / Disliked tags */}
        {hasSentiment && (
          <section style={{ margin: '36px 64px 0' }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 18 }}>★ THEMES FROM THIS FILM</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {likedTags.length > 0 && (
                <div style={{ padding: '20px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--forest)', marginBottom: 12 }}>YOU SEEMED TO LIKE</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {likedTags.map(t => <TagPill key={t} label={t} onRemove={() => setLikedTags(p => p.filter(x => x !== t))} />)}
                  </div>
                </div>
              )}
              {dislikedTags.length > 0 && (
                <div style={{ padding: '20px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>YOU DIDN'T QUITE</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {dislikedTags.map(t => <TagPill key={t} label={t} onRemove={() => setDislikedTags(p => p.filter(x => x !== t))} />)}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Neutral tags (rate-only) */}
        {!hasSentiment && neutralTags.length > 0 && (
          <section style={{ margin: '36px 64px 0' }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ THEMES IN THIS FILM</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {neutralTags.map(t => <TagPill key={t} label={t} onRemove={() => setNeutralTags(p => p.filter(x => x !== t))} />)}
            </div>
            <p style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-4)', margin: '10px 0 0', fontFamily: 'var(--serif-italic)' }}>× out any that don't resonate</p>
          </section>
        )}

        {/* Recommend */}
        {film && (
          <div style={{ margin: '44px 64px 0' }}>
            <RecommendToFriends filmId={film.id} filmTitle={film.title} onDone={() => router.push('/movies')} onSkip={() => {}} />
          </div>
        )}

        {/* Similar films carousel */}
        <section style={{ marginTop: 52 }}>
          <div style={{ padding: '0 64px', marginBottom: 18 }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ FILMS LIKE IT</div>
          </div>
          {loadingSimilar ? (
            <div style={{ padding: '0 64px' }}><p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>finding similar films…</p></div>
          ) : similar.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 64px 16px', scrollbarWidth: 'none' }}>
              {similar.map(s => <SimilarCard key={s.id} film={s} onAdd={list => addToList(s.id, list)} />)}
            </div>
          ) : reflection?.similar && reflection.similar.length > 0 ? (
            <div style={{ padding: '0 64px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {reflection.similar.map((s, i) => (
                <div key={i} style={{ padding: '18px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
                  <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500 }}>{s.title}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--serif-italic)' }}>{s.dir} · {s.year}</div>
                  <p style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-2)', margin: '8px 0 0', lineHeight: 1.5, fontFamily: 'var(--serif-italic)' }}>{s.why}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Actions */}
        <div style={{ margin: '52px 64px 0', paddingTop: 28, borderTop: '0.5px solid var(--paper-edge)', display: 'flex', gap: 12 }}>
          <button className="btn" onClick={() => router.push('/movies')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>see it in your watched list →</button>
          <button className="btn btn-soft" onClick={() => router.push('/home')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>back to home</button>
        </div>
      </div>
    </AppShell>
  )
}
