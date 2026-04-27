'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { TMDBSearchResult, InterviewerPersona, InterviewDepth } from '@/lib/types'

interface Message { role: 'interviewer' | 'me'; text: string }

export default function InterviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [film, setFilm] = useState<TMDBSearchResult | null>(null)
  const [interviewId, setInterviewId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    params.then(async p => {
      setSlug(p.slug)
      const filmData: TMDBSearchResult = JSON.parse(sessionStorage.getItem('sp_film') || '{}')
      const persona = (sessionStorage.getItem('sp_persona') || 'warm') as InterviewerPersona
      const depth = (sessionStorage.getItem('sp_depth') || 'medium') as InterviewDepth

      if (!cancelled) setFilm(filmData)

      try {
        const ratingData = JSON.parse(sessionStorage.getItem('sp_rating') || '{}')
        await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filmId: filmData.id,
            list: 'watched',
            audience: ['me'],
            myStars: ratingData.stars || null,
            myLine: ratingData.line || null,
            moods: ratingData.moods?.length ? ratingData.moods : null,
            rewatch: ratingData.rewatch || null,
          }),
        })

        const res = await fetch('/api/interviews/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filmId: filmData.id, interviewer: persona, depth }),
        })
        const data = await res.json()
        if (!res.ok || !data.interviewId) throw new Error(data.error || 'failed to start interview')

        // Only update state if this effect run is still the current one.
        // React Strict Mode runs effects twice in dev; the first run's
        // completion would overwrite messages the user has already seen.
        if (!cancelled) {
          setInterviewId(data.interviewId)
          setMessages([{ role: 'interviewer', text: data.firstQuestion }])
        }
      } catch (err) {
        if (!cancelled) setInitError(err instanceof Error ? err.message : 'something went wrong')
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })

    return () => { cancelled = true }
  }, [params])

  // Scroll to bottom of chat container whenever messages change
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

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

  const finish = () => {
    sessionStorage.setItem('sp_interviewId', interviewId ?? '')
    router.push(`/add/${slug}/done`)
  }

  const exitToWatched = () => {
    sessionStorage.removeItem('sp_interviewId')
    router.push(`/add/${slug}/done`)
  }

  const persona = (typeof window !== 'undefined' ? sessionStorage.getItem('sp_persona') : null) || 'warm'
  const personaLabel = { warm: 'warm', blunt: 'blunt', playful: 'playful', cinephile: 'cinephile' }[persona] ?? persona

  const HEADER_H = 57   // px — top app bar
  const META_H   = 49   // px — interview meta bar
  const INPUT_H  = 72   // px — bottom input bar

  return (
    <AppShell active="movies" withAdd={false}>
      {showExitConfirm && (
        <div onClick={() => setShowExitConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(24,22,18,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, maxWidth: 400, width: '100%', padding: '32px 36px' }}>
            <p className="t-display" style={{ fontSize: 20, margin: '0 0 10px' }}>leave the interview?</p>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 24px', lineHeight: 1.55, fontFamily: 'var(--serif-italic)' }}>
              the film is already saved. you'll skip the taste reflection.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={exitToWatched} style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}>yes, exit →</button>
              <button className="btn btn-soft" onClick={() => setShowExitConfirm(false)} style={{ padding: '10px 16px', fontSize: 13, borderRadius: 999 }}>keep going</button>
            </div>
          </div>
        </div>
      )}

      {/* Interview meta bar */}
      <div style={{ borderBottom: '0.5px solid var(--paper-edge)', padding: '14px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper)' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
          ★ THE INTERVIEW · {film?.title?.toUpperCase()} · {personaLabel?.toUpperCase()} MODE
        </div>
        <button onClick={() => setShowExitConfirm(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          exit ×
        </button>
      </div>

      {/* Scrollable chat area — fixed height so messages stay visible */}
      <div
        ref={scrollRef}
        style={{
          height: `calc(100vh - ${HEADER_H}px - ${META_H}px - ${INPUT_H}px)`,
          overflowY: 'auto',
          padding: '28px 48px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {initializing && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>★</div>
            <div style={{ padding: '13px 17px', borderRadius: '4px 14px 14px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)' }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>preparing a question…</p>
            </div>
          </div>
        )}

        {initError && (
          <div style={{ padding: '24px 28px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: '0 0 16px', fontFamily: 'var(--serif-italic)' }}>couldn't start — {initError}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => window.location.reload()} style={{ padding: '8px 16px', fontSize: 12, borderRadius: 999 }}>try again</button>
              <button className="btn btn-soft" onClick={exitToWatched} style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999 }}>skip — film is already saved</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, justifyContent: m.role === 'me' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'interviewer' && (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--forest)', color: 'var(--paper)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginTop: 2 }}>★</div>
              )}
              <div style={{
                maxWidth: '78%', padding: '13px 17px',
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
      </div>

      {/* Fixed bottom input */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--paper)', borderTop: '0.5px solid var(--paper-edge)', padding: '14px 48px', display: 'flex', gap: 10, alignItems: 'flex-end', height: INPUT_H }}>
        {done ? (
          <>
            <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', margin: 0, flex: 1, fontFamily: 'var(--serif-italic)', lineHeight: 1.5 }}>
              that's the conversation. ready to see what it says about your taste?
            </p>
            <button className="btn" onClick={finish} style={{ padding: '10px 20px', fontSize: 14, borderRadius: 999, whiteSpace: 'nowrap' }}>
              see my reflection →
            </button>
          </>
        ) : !initializing && !initError ? (
          <>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="your answer… (enter to send)"
              rows={1}
              disabled={!interviewId || loading}
              style={{ flex: 1, padding: '10px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink)', outline: 'none', resize: 'none', lineHeight: 1.5, opacity: !interviewId ? 0.4 : 1 }}
            />
            <button onClick={submit} disabled={!answer.trim() || loading || !interviewId} className="btn" style={{ padding: '10px 18px', borderRadius: 999, opacity: !answer.trim() || loading || !interviewId ? 0.4 : 1 }}>
              →
            </button>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
