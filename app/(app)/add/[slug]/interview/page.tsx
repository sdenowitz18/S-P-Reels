'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, InterviewerPersona, InterviewDepth } from '@/lib/types'

interface Message { role: 'interviewer' | 'me'; text: string }

const INTERVIEWERS: { id: InterviewerPersona; label: string; sub: string }[] = [
  { id: 'warm',      label: 'warm',      sub: 'gentle, starts with feeling' },
  { id: 'blunt',     label: 'blunt',     sub: 'direct, what worked / didn\'t' },
  { id: 'playful',   label: 'playful',   sub: 'unexpected angle, oblique' },
  { id: 'cinephile', label: 'cinephile', sub: 'technical, asks about craft' },
]

const DEPTHS: { id: InterviewDepth; label: string; sub: string }[] = [
  { id: 'short',  label: 'short',  sub: '2 questions' },
  { id: 'medium', label: 'medium', sub: '4 questions' },
  { id: 'long',   label: 'long',   sub: '6 questions' },
]

export default function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [film, setFilm] = useState<TMDBSearchResult | null>(null)
  const [phase, setPhase] = useState<'setup' | 'interview'>('setup')
  const [persona, setPersona] = useState<InterviewerPersona>('warm')
  const [depth, setDepth] = useState<InterviewDepth>('medium')
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    params.then(p => {
      setSlug(p.slug)
      try { setFilm(JSON.parse(sessionStorage.getItem('sp_film') || '{}')) } catch {}
    })
  }, [params])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const startInterview = async () => {
    if (!film || initializing) return
    sessionStorage.setItem('sp_persona', persona)
    sessionStorage.setItem('sp_depth', depth)
    setPhase('interview')
    setInitializing(true)
    setInitError(null)

    try {
      const res = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, interviewer: persona, depth }),
      })
      const data = await res.json()
      if (!res.ok || !data.interviewId) throw new Error(data.error || 'failed to start interview')
      setInterviewId(data.interviewId)
      setMessages([{ role: 'interviewer', text: data.firstQuestion }])
    } catch (err) {
      setInitError(err instanceof Error ? err.message : 'something went wrong')
      setPhase('setup')
    } finally {
      setInitializing(false)
    }
  }

  const submit = async () => {
    if (!answer.trim() || !interviewId || loading) return
    const myAnswer = answer.trim()
    setAnswer('')
    setMessages(prev => [...prev, { role: 'me', text: myAnswer }])
    setLoading(true)

    try {
      const res = await fetch(`/api/interviews/${interviewId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: myAnswer }),
      })
      const data = await res.json()
      setLoading(false)
      if (data.done) {
        setDone(true)
      } else if (data.nextQuestion) {
        setMessages(prev => [...prev, { role: 'interviewer', text: data.nextQuestion }])
      }
    } catch {
      setLoading(false)
    }
  }

  const finishAndRate = async () => {
    if (finishing || !interviewId) return
    setFinishing(true)
    try {
      const res = await fetch(`/api/interviews/${interviewId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      sessionStorage.setItem('sp_interviewId', interviewId)
      if (data) sessionStorage.setItem('sp_reflection', JSON.stringify(data))
      if (data.aiRating) sessionStorage.setItem('sp_ai_suggestion', JSON.stringify(data.aiRating))
      if (data.sentimentTags) sessionStorage.setItem('sp_sentiment_tags', JSON.stringify(data.sentimentTags))
    } catch {
      sessionStorage.setItem('sp_interviewId', interviewId)
    }
    router.push(`/add/${slug}/rate`)
  }

  const exitToRate = () => {
    sessionStorage.removeItem('sp_interviewId')
    setShowExitConfirm(false)
    router.push(`/add/${slug}/rate`)
  }

  const HEADER_H = 57
  const META_H   = 49
  const INPUT_H  = 72

  // ── SETUP PHASE ──────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <AppShell active="movies" withAdd={false}>
        <div style={{ padding: '14px 48px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => router.push(`/add/${slug}/stage`)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)',
          }}>← back</button>
        </div>

        <div style={{ padding: '48px 64px', maxWidth: 720, margin: '0 auto' }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>★ SET UP YOUR INTERVIEW</div>
          <h1 className="t-display" style={{ fontSize: 44, lineHeight: 1, marginTop: 16, marginBottom: 8 }}>
            how do you want to talk about <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>{film?.title}</span>?
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 36px', lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
            pick a style and length — we'll start when you're ready.
          </p>

          <div style={{ marginBottom: 28 }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 12 }}>INTERVIEWER STYLE</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {INTERVIEWERS.map(p => (
                <button key={p.id} onClick={() => setPersona(p.id)} style={{
                  padding: '10px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: `${persona === p.id ? '1.5px solid var(--ink)' : '0.5px solid var(--paper-edge)'}`,
                  background: persona === p.id ? 'var(--ink)' : 'var(--paper)',
                  color: persona === p.id ? 'var(--paper)' : 'var(--ink)',
                  transition: 'all 150ms',
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p.label}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 11, color: persona === p.id ? 'rgba(255,255,255,0.6)' : 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 36 }}>
            <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 12 }}>LENGTH</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {DEPTHS.map(d => (
                <button key={d.id} onClick={() => setDepth(d.id)} style={{
                  padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                  border: `${depth === d.id ? '1.5px solid var(--forest)' : '0.5px solid var(--paper-edge)'}`,
                  background: depth === d.id ? 'var(--forest)' : 'var(--paper)',
                  color: depth === d.id ? 'var(--paper)' : 'var(--ink)',
                  transition: 'all 150ms',
                  fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  {d.label} <span style={{ opacity: 0.6, fontSize: 10 }}>— {d.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {initError && (
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--bone)', borderRadius: 8, border: '0.5px solid var(--paper-edge)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)' }}>
                couldn't start — {initError}. try again.
              </p>
            </div>
          )}

          <button
            className="btn"
            onClick={startInterview}
            disabled={!film || initializing}
            style={{ padding: '13px 26px', fontSize: 15, borderRadius: 999, opacity: initializing ? 0.5 : 1 }}
          >
            {initializing ? 'starting…' : 'start the interview →'}
          </button>
        </div>
      </AppShell>
    )
  }

  // ── INTERVIEW PHASE ───────────────────────────────────────────────────────────
  return (
    <AppShell active="movies" withAdd={false}>
      {showExitConfirm && (
        <div onClick={() => setShowExitConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,18,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, maxWidth: 400, width: '100%', padding: '32px 36px' }}>
            <p className="t-display" style={{ fontSize: 20, margin: '0 0 10px' }}>leave the interview?</p>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 24px', lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
              you'll still rate it — you'll just skip the taste reflection.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={exitToRate} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>yes, exit →</button>
              <button className="btn btn-soft" onClick={() => setShowExitConfirm(false)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 999 }}>keep going</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ borderBottom: '0.5px solid var(--paper-edge)', padding: '14px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper)' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          ★ THE INTERVIEW · {film?.title?.toUpperCase()} · {persona.toUpperCase()} MODE
        </div>
        <button onClick={() => setShowExitConfirm(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          exit ×
        </button>
      </div>

      <div ref={scrollRef} style={{ height: `calc(100vh - ${HEADER_H}px - ${META_H}px - ${INPUT_H}px)`, overflowY: 'auto', padding: '28px 48px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {initializing && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>★</div>
            <div style={{ padding: '13px 17px', borderRadius: '4px 14px 14px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>preparing a question…</p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, justifyContent: m.role === 'me' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'interviewer' && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginTop: 2 }}>★</div>
              )}
              <div style={{ maxWidth: '78%', padding: '13px 17px', borderRadius: m.role === 'interviewer' ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: m.role === 'interviewer' ? 'var(--bone)' : 'var(--ink)', color: m.role === 'me' ? 'var(--paper)' : 'var(--ink)', border: m.role === 'interviewer' ? '0.5px solid var(--paper-edge)' : 'none' }}>
                <p style={{ margin: 0, fontFamily: m.role === 'interviewer' ? 'var(--serif-body)' : 'var(--serif-italic)', fontStyle: m.role === 'me' ? 'italic' : 'normal', fontSize: 15, lineHeight: 1.6 }}>{m.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>★</div>
              <div style={{ padding: '13px 17px', borderRadius: '4px 14px 14px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)' }}>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>thinking…</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--paper)', borderTop: '0.5px solid var(--paper-edge)', padding: '14px 48px', display: 'flex', gap: 10, alignItems: 'flex-end', height: INPUT_H }}>
        {done ? (
          <>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: 0, flex: 1, fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
              that's the conversation. ready to rate it?
            </p>
            <button className="btn" onClick={finishAndRate} disabled={finishing} style={{ padding: '10px 20px', fontSize: 14, borderRadius: 999, whiteSpace: 'nowrap', opacity: finishing ? 0.5 : 1 }}>
              {finishing ? 'wrapping up…' : 'rate it →'}
            </button>
          </>
        ) : !initializing ? (
          <>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }} placeholder="your answer… (enter to send)" rows={1} disabled={!interviewId || loading} style={{ flex: 1, padding: '10px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', outline: 'none', resize: 'none', lineHeight: 1.5, opacity: !interviewId ? 0.4 : 1 }} />
            <button onClick={submit} disabled={!answer.trim() || loading || !interviewId} className="btn" style={{ padding: '10px 18px', borderRadius: 999, opacity: !answer.trim() || loading || !interviewId ? 0.4 : 1 }}>→</button>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
