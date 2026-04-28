'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult } from '@/lib/types'

function HalfStarRow({ label, tint, ink, stars, setStars }: {
  label: string; tint: string; ink: string; stars: number; setStars: (n: number) => void
}) {
  const handleClick = (slot: number, isLeft: boolean) => {
    const value = isLeft ? slot - 0.5 : slot
    setStars(stars === value ? 0 : value)
  }
  return (
    <div style={{ padding: '14px 18px', background: tint, borderRadius: 10, border: `0.5px solid ${ink}40` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="t-meta" style={{ fontSize: 10, color: ink }}>{label.toUpperCase()}</div>
        {stars > 0 && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: ink }}>{stars}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(slot => {
          const filled = stars >= slot
          const half = !filled && stars >= slot - 0.5
          return (
            <div key={slot} style={{ position: 'relative', width: 36, height: 36 }}>
              <span style={{ position: 'absolute', inset: 0, fontSize: 30, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>★</span>
              {(filled || half) && (
                <span style={{ position: 'absolute', inset: 0, fontSize: 30, color: ink, display: 'flex', alignItems: 'center', justifyContent: 'center', clipPath: half ? 'inset(0 50% 0 0)' : 'none', pointerEvents: 'none' }}>★</span>
              )}
              <button onClick={() => handleClick(slot, true)} aria-label={`${slot - 0.5} stars`} style={{ position: 'absolute', left: 0, top: 0, width: '50%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />
              <button onClick={() => handleClick(slot, false)} aria-label={`${slot} stars`} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const SUGGESTED_MOODS = ['quiet', 'aching', 'painterly', 'unhinged', 'wickedly-funny', 'memory', 'romantic', 'slow-burn', 'devastating', 'cathartic', 'tense', 'absurd', 'nostalgic', 'hopeful', 'bleak', 'warm', 'hypnotic', 'disorienting']

function MoodPills({ tags, setTags }: { tags: string[]; setTags: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  const addTag = (tag: string) => {
    const clean = tag.toLowerCase().trim().replace(/\s+/g, '-')
    if (!clean || tags.includes(clean)) return
    setTags([...tags, clean])
    setInput('')
  }
  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag))
  const toggle = (m: string) => tags.includes(m) ? removeTag(m) : addTag(m)
  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {tags.map(t => (
            <button key={t} onClick={() => removeTag(t)} style={{ padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', border: '0.5px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {t.replace(/-/g, ' ')} <span style={{ opacity: 0.6, fontSize: 10 }}>×</span>
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) } }} placeholder="type your own tag + enter…" style={{ flex: 1, padding: '8px 12px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink)', outline: 'none' }} />
        <button onClick={() => addTag(input)} disabled={!input.trim()} className="btn btn-soft" style={{ padding: '8px 14px', fontSize: 12, borderRadius: 8, opacity: !input.trim() ? 0.4 : 1 }}>add</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {SUGGESTED_MOODS.filter(m => !tags.includes(m)).map(m => (
          <button key={m} onClick={() => toggle(m)} style={{ padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', border: '0.5px solid var(--paper-edge)', background: 'transparent', color: 'var(--ink-3)', transition: 'all 120ms' }}>{m}</button>
        ))}
      </div>
    </div>
  )
}

const REWATCH_OPTIONS = [
  { id: 'yes',   label: 'yes',   sub: 'would sit down with it again' },
  { id: 'maybe', label: 'maybe', sub: 'under the right circumstances' },
  { id: 'no',    label: 'no',    sub: 'once was enough' },
]

export default function RatePage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [film, setFilm]     = useState<TMDBSearchResult | null>(null)
  const [slug, setSlug]     = useState('')
  const [flow, setFlow]     = useState<'rate' | 'reflect'>('rate')
  const [aiSuggestion, setAiSuggestion] = useState<{ stars: number; reasoning: string } | null>(null)
  const [stars, setStars]   = useState(0)
  const [line, setLine]     = useState('')
  const [moods, setMoods]   = useState<string[]>([])
  const [rewatch, setRewatch] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    params.then(p => {
      setSlug(p.slug)
      try { setFilm(JSON.parse(sessionStorage.getItem('sp_film') || '{}')) } catch {}
      const f = (sessionStorage.getItem('sp_flow') || 'rate') as 'rate' | 'reflect'
      setFlow(f)
      if (f === 'reflect') {
        try {
          const raw = sessionStorage.getItem('sp_ai_suggestion')
          if (raw) setAiSuggestion(JSON.parse(raw))
        } catch {}
      }
    })
  }, [params])

  const save = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film?.id, list: 'watched', audience: ['me'], myStars: stars || null, myLine: line.trim() || null, moods: moods.length ? moods : null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'save failed') }
      sessionStorage.setItem('sp_rating', JSON.stringify({ stars, line, moods, rewatch }))
      router.push(`/add/${slug}/done`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'something went wrong — try again')
      setSaving(false)
    }
  }

  return (
    <AppShell active="movies">
      <div style={{ padding: '14px 36px 0', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => router.push(`/add/${slug}/stage`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>← back</button>
      </div>

      <div style={{ padding: '48px 64px', maxWidth: 760, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ RATE IT</div>
        <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1, marginTop: 16, marginBottom: 24 }}>
          how was <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>{film?.title}</span>?
        </h1>

        {aiSuggestion && (
          <div style={{ marginBottom: 28, padding: '18px 22px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--sun)', letterSpacing: '-0.02em' }}>{aiSuggestion.stars}★</div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginTop: 2 }}>AI GUESS</div>
            </div>
            <div>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 4 }}>BASED ON YOUR CONVERSATION</div>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>{aiSuggestion.reasoning}</p>
            </div>
          </div>
        )}

        <HalfStarRow label="your rating" tint="var(--s-tint)" ink="var(--s-ink)" stars={stars} setStars={setStars} />

        <div style={{ marginTop: 24 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>WHAT WAS IT? (OPTIONAL)</div>
          <MoodPills tags={moods} setTags={setMoods} />
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>WOULD YOU WATCH IT AGAIN? (OPTIONAL)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {REWATCH_OPTIONS.map(r => (
              <button key={r.id} onClick={() => setRewatch(rewatch === r.id ? null : r.id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', textAlign: 'left', flex: 1, border: `${rewatch === r.id ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`, background: rewatch === r.id ? 'var(--ink)' : 'var(--paper)', color: rewatch === r.id ? 'var(--paper)' : 'var(--ink)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{r.label}</div>
                <div style={{ fontStyle: 'italic', fontSize: 11, color: rewatch === r.id ? 'rgba(255,255,255,0.6)' : 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>{r.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>ONE LINE FOR FUTURE-YOU (OPTIONAL)</div>
          <input value={line} onChange={e => setLine(e.target.value)} placeholder="the thing you don't want to forget…" style={{ width: '100%', padding: '14px 16px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {saveError && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bone)', borderRadius: 8, border: '0.5px solid var(--paper-edge)' }}>
            <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)' }}>{saveError}</p>
          </div>
        )}

        <div style={{ marginTop: 32 }}>
          <button className="btn" onClick={save} disabled={saving} style={{ padding: '12px 26px', fontSize: 14, borderRadius: 999, opacity: saving ? 0.5 : 1 }}>
            {saving ? 'saving…' : 'save →'}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
