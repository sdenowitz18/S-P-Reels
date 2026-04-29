'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, InterviewerPersona, InterviewTopic, ALL_TOPICS, TOPIC_LABELS } from '@/lib/types'
import { FilmBrief } from '@/lib/prompts/film-brief'

interface Message { role: 'interviewer' | 'me'; text: string }

const INTERVIEWERS: { id: InterviewerPersona; label: string; sub: string }[] = [
  { id: 'warm',      label: 'warm',      sub: 'gentle, starts with feeling' },
  { id: 'blunt',     label: 'blunt',     sub: 'direct, what worked / didn\'t' },
  { id: 'playful',   label: 'playful',   sub: 'unexpected angle, oblique' },
  { id: 'cinephile', label: 'cinephile', sub: 'technical, asks about craft' },
]

export default function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [film, setFilm] = useState<TMDBSearchResult | null>(null)
  const [phase, setPhase] = useState<'setup' | 'interview'>('setup')
  const [persona, setPersona] = useState<InterviewerPersona>('warm')
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // topic state
  const [showTopicPicker, setShowTopicPicker] = useState(false)
  const [currentTopic, setCurrentTopic] = useState<InterviewTopic | null>(null)
  const [usedTopics, setUsedTopics] = useState<InterviewTopic[]>([])
  const [brief, setBrief] = useState<FilmBrief | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [topOffset, setTopOffset] = useState(100)
  const [bottomOffset, setBottomOffset] = useState(130)

  useEffect(() => {
    params.then(p => {
      setSlug(p.slug)
      try { setFilm(JSON.parse(sessionStorage.getItem('sp_film') || '{}')) } catch {}
    })
  }, [params])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, showTopicPicker])

  // Measure actual header + bottom bar heights so scroll area fits exactly
  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setTopOffset(headerRef.current.getBoundingClientRect().bottom)
      if (bottomRef.current) setBottomOffset(bottomRef.current.getBoundingClientRect().height)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [phase, showTopicPicker])

  const startInterview = async () => {
    if (!film || initializing) return
    sessionStorage.setItem('sp_persona', persona)
    setPhase('interview')
    setInitializing(true)
    setInitError(null)

    try {
      const res = await fetch('/api/interviews/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filmId: film.id, interviewer: persona }),
      })
      const data = await res.json()
      if (!res.ok || !data.interviewId) throw new Error(data.error || 'failed to start interview')
      setInterviewId(data.interviewId)
      if (data.brief) setBrief(data.brief)
      setShowTopicPicker(true)
    } catch (err) {
      setInitError(err instanceof Error ? err.message : 'something went wrong')
      setPhase('setup')
    } finally {
      setInitializing(false)
    }
  }

  const pickTopic = async (topic: InterviewTopic) => {
    if (!interviewId || loading) return
    setShowTopicPicker(false)
    setCurrentTopic(topic)
    if (topic !== 'surprise-me') {
      setUsedTopics(prev => prev.includes(topic) ? prev : [...prev, topic])
    }
    setLoading(true)

    try {
      const res = await fetch(`/api/interviews/${interviewId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, action: 'topic' }),
      })
      const data = await res.json()
      if (data.question) setMessages(prev => [...prev, { role: 'interviewer', text: data.question }])
    } catch {
      // silently fall back
    } finally {
      setLoading(false)
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
        body: JSON.stringify({ answer: myAnswer, topic: currentTopic }),
      })
      const data = await res.json()
      if (data.nextQuestion) setMessages(prev => [...prev, { role: 'interviewer', text: data.nextQuestion }])
    } catch {
      // silently fall back
    } finally {
      setLoading(false)
    }
  }

  const nextQuestion = async () => {
    if (!interviewId || loading || !currentTopic) return
    setLoading(true)

    try {
      const res = await fetch(`/api/interviews/${interviewId}/question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: currentTopic, action: 'lateral' }),
      })
      const data = await res.json()
      if (data.question) setMessages(prev => [...prev, { role: 'interviewer', text: data.question }])
    } catch {
      // silently fall back
    } finally {
      setLoading(false)
    }
  }

  const newLineOfQuestioning = () => {
    setShowTopicPicker(true)
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

  // available topics = all except used ones; surprise-me always last
  const availableTopics = ALL_TOPICS.filter(t => t === 'surprise-me' || !usedTopics.includes(t))

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
            how do you want to talk about{' '}
            <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--sun)' }}>{film?.title}</span>?
          </h1>
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 36px', lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
            pick an interviewer style — you'll drive the conversation from there.
          </p>

          <div style={{ marginBottom: 36 }}>
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

      {/* Header */}
      <div ref={headerRef} style={{ borderBottom: '0.5px solid var(--paper-edge)', padding: '14px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper)' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          ★ THE INTERVIEW · {film?.title?.toUpperCase()} · {persona.toUpperCase()} MODE
        </div>
        <button onClick={() => setShowExitConfirm(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          exit ×
        </button>
      </div>

      {/* Scrollable content area */}
      <div
        ref={scrollRef}
        style={{
          height: `calc(100vh - ${topOffset}px - ${bottomOffset}px)`,
          overflowY: 'auto',
          padding: showTopicPicker ? '40px 48px 40px' : '28px 48px 32px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Topic picker */}
        {showTopicPicker && (
          <div>
            <p style={{
              fontFamily: 'var(--serif-display)',
              fontSize: messages.length === 0 ? 28 : 20,
              fontWeight: 500,
              margin: '0 0 24px',
              lineHeight: 1.2,
            }}>
              {messages.length === 0 ? 'what do you want to talk about?' : 'what do you want to get into next?'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {availableTopics.map(topic => (
                <button
                  key={topic}
                  onClick={() => pickTopic(topic)}
                  disabled={loading}
                  style={{
                    padding: '11px 20px',
                    borderRadius: 999,
                    cursor: loading ? 'default' : 'pointer',
                    border: '0.5px solid var(--paper-edge)',
                    background: topic === 'surprise-me' ? 'var(--bone)' : 'var(--paper)',
                    color: 'var(--ink)',
                    fontFamily: 'var(--serif-body)',
                    fontSize: 14,
                    transition: 'all 150ms',
                    opacity: loading ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bone)' }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = topic === 'surprise-me' ? 'var(--bone)' : 'var(--paper)' }}
                >
                  {TOPIC_LABELS[topic]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {!showTopicPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, justifyContent: m.role === 'me' ? 'flex-end' : 'flex-start' }}>
                {m.role === 'interviewer' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginTop: 2 }}>★</div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '13px 17px',
                  borderRadius: m.role === 'interviewer' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                  background: m.role === 'interviewer' ? 'var(--bone)' : 'var(--ink)',
                  color: m.role === 'me' ? 'var(--paper)' : 'var(--ink)',
                  border: m.role === 'interviewer' ? '0.5px solid var(--paper-edge)' : 'none',
                }}>
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
        )}
      </div>

      {/* Bottom bar */}
      <div ref={bottomRef} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--paper)',
        borderTop: '0.5px solid var(--paper-edge)',
        padding: '12px 48px 14px',
      }}>
        {/* Answer input — only when conversation is active */}
        {!showTopicPicker && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="your answer… (enter to send)"
              rows={1}
              disabled={!interviewId || loading}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8,
                fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)',
                outline: 'none', resize: 'none', lineHeight: 1.5,
                opacity: !interviewId ? 0.4 : 1,
              }}
            />
            <button
              onClick={submit}
              disabled={!answer.trim() || loading || !interviewId}
              className="btn"
              style={{ padding: '10px 18px', borderRadius: 999, opacity: !answer.trim() || loading || !interviewId ? 0.4 : 1 }}
            >→</button>
          </div>
        )}

        {/* Action row — always visible once interview has started */}
        {!showTopicPicker && interviewId && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
            <button
              onClick={nextQuestion}
              disabled={loading || !currentTopic}
              style={{
                padding: '9px 20px', borderRadius: 999,
                cursor: loading || !currentTopic ? 'default' : 'pointer',
                background: 'var(--bone)', border: '0.5px solid var(--paper-edge)',
                fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink)',
                opacity: loading || !currentTopic ? 0.35 : 1, transition: 'all 150ms',
              }}
            >
              next question
            </button>
            <button
              onClick={newLineOfQuestioning}
              disabled={loading}
              style={{
                padding: '9px 20px', borderRadius: 999,
                cursor: loading ? 'default' : 'pointer',
                background: 'var(--bone)', border: '0.5px solid var(--paper-edge)',
                fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink)',
                opacity: loading ? 0.35 : 1, transition: 'all 150ms',
              }}
            >
              new line of questioning
            </button>
            <button
              onClick={finishAndRate}
              disabled={finishing}
              className="btn"
              style={{ padding: '9px 22px', fontSize: 13, borderRadius: 999, opacity: finishing ? 0.5 : 1 }}
            >
              {finishing ? 'wrapping up…' : 'finish →'}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
