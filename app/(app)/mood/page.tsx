'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { Film, posterUrl } from '@/lib/types'
import Image from 'next/image'

const MOODS = ['quiet', 'aching', 'painterly', 'unhinged', 'wickedly-funny', 'memory', 'romantic', 'slow-burn', 'devastating', 'cathartic', 'tense', 'absurd', 'nostalgic', 'hopeful', 'bleak', 'hypnotic']
const RUNTIMES = [
  { id: 'any', label: 'any length' },
  { id: 'short', label: 'under 90 min' },
  { id: 'long', label: '2+ hours' },
]
const KINDS = [
  { id: 'any', label: 'either' },
  { id: 'movie', label: 'film' },
  { id: 'tv', label: 'series' },
]

const DISCUSS_QUESTIONS = [
  'do you want something that challenges you, or something that wraps you up?',
  'are you in the mood to feel something, or to escape feeling?',
  'new director or a filmmaker you already trust?',
  "something you'll talk about after, or something you can just let wash over you?",
  'do you want a slow burn or something that pulls you in immediately?',
  'are you open to subtitles tonight?',
  'do you want to laugh at all, even a little?',
]

interface Rec { film: Film; why: string }

function RecCard({ rec, onSave }: { rec: Rec; onSave: (film: Film) => void }) {
  const poster = rec.film ? posterUrl(rec.film.poster_path, 'w342') : null
  const [saved, setSaved] = useState(false)

  const save = async () => {
    await onSave(rec.film)
    setSaved(true)
  }

  return (
    <div style={{ padding: '24px 26px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ width: 64, height: 96, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'var(--bone)' }}>
          {poster && <Image src={poster} alt={rec.film.title} fill style={{ objectFit: 'cover' }} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 19, fontWeight: 500, lineHeight: 1.15 }}>{rec.film.title}</div>
          <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--serif-italic)' }}>
            {rec.film.director}{rec.film.director && rec.film.year ? ' · ' : ''}{rec.film.year}
            {rec.film.runtime_minutes ? ` · ${rec.film.runtime_minutes} min` : ''}
          </div>
          <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', margin: '10px 0 0', lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
            {rec.why}
          </p>
          <div style={{ marginTop: 14 }}>
            {saved ? (
              <span style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>saved to watch list ✓</span>
            ) : (
              <button className="btn btn-soft" onClick={save} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 999 }}>
                save to watch list →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MoodPage() {
  const router = useRouter()
  const [moods, setMoods] = useState<string[]>([])
  const [runtime, setRuntime] = useState('any')
  const [kind, setKind] = useState('any')
  const [loading, setLoading] = useState(false)
  const [picks, setPicks] = useState<Rec[]>([])
  const [hasTaste, setHasTaste] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'picks' | 'discuss'>('picks')
  const [discussIdx, setDiscussIdx] = useState(0)

  const toggleMood = (m: string) => setMoods(arr => arr.includes(m) ? arr.filter(x => x !== m) : [...arr, m])

  const recommend = async () => {
    setLoading(true)
    setPicks([])
    setError(null)
    const res = await fetch('/api/mood/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, moods, runtime, audience: 'me', count: 3 }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error || !data.picks?.length) { setError('couldn\'t find anything — try different moods'); return }
    setPicks(data.picks)
    setHasTaste(data.hasTaste)
  }

  const saveToList = async (film: Film) => {
    await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmId: film.id, list: 'watchlist', audience: ['me'] }),
    })
  }

  const nextDiscussQuestion = () => {
    setDiscussIdx(i => (i + 1) % DISCUSS_QUESTIONS.length)
  }

  return (
    <AppShell active="mood">
      <div style={{ padding: 'clamp(28px,5vw,56px) clamp(16px,5vw,64px) clamp(96px,10vw,96px)', maxWidth: 960, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ MOOD ROOM</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>
          what do you feel like <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sp-ink)' }}>watching</span>?
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 560 }}>
          pick a feeling, get three options. or use the discussion prompts to figure out what you actually want.
        </p>

        {/* Mode switcher */}
        <div style={{ marginTop: 32, display: 'flex', gap: 8 }}>
          {[
            { id: 'picks', label: 'find something' },
            { id: 'discuss', label: 'help me decide' },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id as 'picks' | 'discuss')} style={{
              padding: '8px 18px', borderRadius: 999, cursor: 'pointer',
              border: `${mode === m.id ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
              background: mode === m.id ? 'var(--ink)' : 'var(--paper)',
              color: mode === m.id ? 'var(--paper)' : 'var(--ink)',
              fontFamily: 'var(--serif-body)', fontSize: 13,
            }}>{m.label}</button>
          ))}
        </div>

        {/* Discuss mode */}
        {mode === 'discuss' && (
          <div style={{ marginTop: 40, padding: '36px 40px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 16 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 20 }}>★ A QUESTION TO HELP YOU DECIDE</div>
            <p className="t-display" style={{ fontSize: 26, lineHeight: 1.4, margin: '0 0 32px', maxWidth: 560 }}>
              {DISCUSS_QUESTIONS[discussIdx]}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={nextDiscussQuestion} style={{ padding: '10px 20px', fontSize: 13, borderRadius: 999 }}>next question →</button>
              <button className="btn btn-soft" onClick={() => setMode('picks')} style={{ padding: '10px 16px', fontSize: 12, borderRadius: 999 }}>find something instead</button>
            </div>
          </div>
        )}

        {/* Picks mode */}
        {mode === 'picks' && (
          <>
            <div style={{ marginTop: 32 }}>
              <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 12 }}>THE FEELING</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {MOODS.map(m => (
                  <button key={m} onClick={() => toggleMood(m)} style={{
                    padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                    border: `0.5px solid ${moods.includes(m) ? 'var(--ink)' : 'var(--paper-edge)'}`,
                    background: moods.includes(m) ? 'var(--ink)' : 'transparent',
                    color: moods.includes(m) ? 'var(--paper)' : 'var(--ink-3)',
                    transition: 'all 120ms',
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>FORMAT</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {KINDS.map(k => (
                    <button key={k.id} onClick={() => setKind(k.id)} style={{
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `${kind === k.id ? '1px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
                      background: kind === k.id ? 'var(--ink)' : 'var(--paper)',
                      color: kind === k.id ? 'var(--paper)' : 'var(--ink)',
                      fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>{k.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>LENGTH</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {RUNTIMES.map(r => (
                    <button key={r.id} onClick={() => setRuntime(r.id)} style={{
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `${runtime === r.id ? '1px solid var(--forest)' : '0.5px solid var(--paper-edge)'}`,
                      background: runtime === r.id ? 'var(--forest)' : 'var(--paper)',
                      color: runtime === r.id ? 'var(--paper)' : 'var(--ink)',
                      fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>{r.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'center' }}>
              <button className="btn" onClick={recommend} disabled={loading} style={{ padding: '13px 26px', fontSize: 14, borderRadius: 999, opacity: loading ? 0.5 : 1 }}>
                {loading ? 'finding three options…' : 'find three films →'}
              </button>
              {picks.length > 0 && !loading && (
                <button className="btn btn-soft" onClick={recommend} style={{ padding: '11px 18px', fontSize: 12, borderRadius: 999 }}>
                  try again
                </button>
              )}
            </div>

            {error && (
              <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', marginTop: 20, fontFamily: 'var(--serif-italic)' }}>{error}</p>
            )}

            {picks.length > 0 && !loading && (
              <div style={{ marginTop: 40 }}>
                {hasTaste && (
                  <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 16 }}>
                    ★ PICKED FROM YOUR TASTE PROFILE + TONIGHT'S MOOD
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {picks.map((rec, i) => (
                    <RecCard key={i} rec={rec} onSave={saveToList} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
