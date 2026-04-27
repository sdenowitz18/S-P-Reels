'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, ReflectionResult, posterUrl } from '@/lib/types'
import { RecommendToFriends } from '@/components/recommend-to-friends'
import Image from 'next/image'

export default function DonePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [film, setFilm] = useState<TMDBSearchResult | null>(null)
  const [status, setStatus] = useState<'finished' | 'now-playing'>('finished')
  const [reflection, setReflection] = useState<ReflectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [savedTags, setSavedTags] = useState(false)

  useEffect(() => {
    params.then(async p => {
      setSlug(p.slug)
      const filmData: TMDBSearchResult = JSON.parse(sessionStorage.getItem('sp_film') || '{}')
      const st = (sessionStorage.getItem('sp_status') || 'finished') as 'finished' | 'now-playing'
      const interviewId = sessionStorage.getItem('sp_interviewId')
      setFilm(filmData)
      setStatus(st)

      if (st === 'now-playing') {
        // save as now playing
        await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filmId: filmData.id, list: 'now_playing', audience: ['me'] }),
        })
        return
      }

      if (interviewId) {
        setLoading(true)
        const ratingData = JSON.parse(sessionStorage.getItem('sp_rating') || '{}')
        const res = await fetch(`/api/interviews/${interviewId}/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ myStars: ratingData.stars || null, myLine: ratingData.line || null }),
        })
        const data = await res.json()
        setReflection({ taste_tags: data.taste_tags, taste_note: data.tasteRead, shifts: data.shifts, similar: data.similar })
        setLoading(false)
        // clear session keys
        sessionStorage.removeItem('sp_interviewId')
        sessionStorage.removeItem('sp_rating')
        sessionStorage.removeItem('sp_persona')
        sessionStorage.removeItem('sp_depth')
      }
    })
  }, [params])

  const poster = film ? posterUrl(film.poster_path, 'w342') : null

  if (status === 'now-playing') {
    return (
      <AppShell active="now">
        <div style={{ padding: '80px 64px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="stamp" style={{ display: 'inline-block', marginBottom: 40 }}>rolling</div>
          <h1 className="t-display" style={{ fontSize: 56, lineHeight: 1, marginBottom: 16 }}>
            {film?.title} is <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>now playing</span>.
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginTop: 18, lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
            rolling now — we'll be here when you finish.
          </p>
          {film && (
            <div style={{ textAlign: 'left' }}>
              <RecommendToFriends
                filmId={film.id}
                filmTitle={film.title}
                onDone={() => router.push('/now-playing')}
                onSkip={() => router.push('/now-playing')}
              />
            </div>
          )}
          <div style={{ marginTop: 24, display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button className="btn" onClick={() => router.push('/now-playing')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>see what's playing →</button>
            <button className="btn btn-soft" onClick={() => router.push('/home')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>back to home</button>
          </div>
        </div>
      </AppShell>
    )
  }

  // no interview — simple done screen
  if (!reflection && !loading) {
    return (
      <AppShell active="movies">
        <div style={{ padding: '80px 64px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="stamp" style={{ display: 'inline-block', marginBottom: 40 }}>added</div>
          <h1 className="t-display" style={{ fontSize: 56, lineHeight: 1 }}>
            {film?.title} is in your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>watched list</span>.
          </h1>
          {film && (
            <div style={{ textAlign: 'left' }}>
              <RecommendToFriends
                filmId={film.id}
                filmTitle={film.title}
                onDone={() => router.push('/movies')}
                onSkip={() => router.push('/movies')}
              />
            </div>
          )}
          <div style={{ marginTop: 24, display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button className="btn" onClick={() => router.push('/movies')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>see your watched list →</button>
            <button className="btn btn-soft" onClick={() => router.push('/home')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>back to home</button>
          </div>
        </div>
      </AppShell>
    )
  }

  // reflection screen
  return (
    <AppShell active="movies">
      <div style={{ padding: '64px 56px 96px', maxWidth: 980, margin: '0 auto' }}>
        <div className="stamp" style={{ display: 'inline-block', marginBottom: 28 }}>added</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 14 }}>
          a few thoughts on <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>{film?.title}</span>.
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.55, fontFamily: 'var(--serif-italic)', maxWidth: 620 }}>
          we listened back to what you said. here's what we kept — and what it tells us about your taste.
        </p>

        {/* What we logged */}
        <section style={{ marginTop: 48, padding: '28px 32px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ WHAT WE LOGGED</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {poster && (
              <div style={{ width: 60, height: 90, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                <Image src={poster} alt={film?.title ?? ''} width={60} height={90} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 26, fontWeight: 500, lineHeight: 1.15 }}>{film?.title}</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--serif-italic)' }}>
                {film?.director}{film?.director && film?.year ? ' · ' : ''}{film?.year}
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <section style={{ marginTop: 32 }}>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>reading what you said…</p>
          </section>
        )}

        {reflection && (
          <>
            {/* Taste read */}
            <section style={{ marginTop: 32 }}>
              <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ WHAT THIS SAYS ABOUT YOUR TASTE</div>
              <p className="t-display" style={{ fontSize: 22, lineHeight: 1.4, margin: 0, maxWidth: 720 }}>
                {reflection.taste_note}
              </p>
              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {reflection.taste_tags.map(t => (
                  <span key={t} style={{ padding: '6px 12px', borderRadius: 999, background: savedTags ? 'var(--sun-tint)' : 'var(--paper-2)', border: `0.5px solid ${savedTags ? 'var(--sun)' : 'var(--paper-edge)'}`, fontFamily: 'var(--serif-body)', fontSize: 12, color: 'var(--ink-2)' }}>
                    {t.replace(/-/g, ' ')}
                  </span>
                ))}
                {!savedTags && (
                  <button onClick={() => setSavedTags(true)} className="btn btn-soft" style={{ marginLeft: 6, padding: '6px 12px', fontSize: 11, borderRadius: 999 }}>
                    add to my taste profile →
                  </button>
                )}
                {savedTags && <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginLeft: 6 }}>added to your profile</span>}
              </div>
            </section>

            {/* How it fits */}
            {reflection.shifts && (
              <section style={{ marginTop: 36 }}>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ HOW IT FITS</div>
                <p className="t-display" style={{ fontSize: 20, lineHeight: 1.45, margin: 0, fontStyle: 'italic', fontWeight: 300, color: 'var(--ink-2)', maxWidth: 720, fontFamily: 'var(--serif-italic)' }}>
                  {reflection.shifts}
                </p>
              </section>
            )}

            {/* Similar films */}
            {reflection.similar.length > 0 && (
              <section style={{ marginTop: 44 }}>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 18 }}>★ OTHER FILMS LIKE IT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {reflection.similar.map((s, i) => (
                    <div key={i} style={{ padding: '20px 22px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
                      <div style={{ fontFamily: 'var(--serif-display)', fontSize: 17, fontWeight: 500, lineHeight: 1.2 }}>{s.title}</div>
                      <div style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontFamily: 'var(--serif-italic)' }}>{s.dir}{s.dir && s.year ? ' · ' : ''}{s.year}</div>
                      <p style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5, margin: '10px 0 0', fontFamily: 'var(--serif-italic)' }}>{s.why}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {film && (
          <RecommendToFriends
            filmId={film.id}
            filmTitle={film.title}
            onDone={() => router.push('/movies')}
            onSkip={() => router.push('/movies')}
          />
        )}

        <div style={{ marginTop: 32, paddingTop: 28, borderTop: '0.5px solid var(--paper-edge)', display: 'flex', gap: 12 }}>
          <button className="btn" onClick={() => router.push('/movies')} style={{ padding: '12px 22px', fontSize: 14, borderRadius: 999 }}>
            see it in your watched list →
          </button>
          <button className="btn btn-soft" onClick={() => router.push('/home')} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>
            back to home
          </button>
        </div>
      </div>
    </AppShell>
  )
}
