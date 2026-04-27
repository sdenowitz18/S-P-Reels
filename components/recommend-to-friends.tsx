'use client'
import { useEffect, useState } from 'react'

interface Friend { id: string; name: string; email: string }

interface Props {
  filmId: string | number
  filmTitle: string
  onDone: () => void
  onSkip: () => void
}

export function RecommendToFriends({ filmId, filmTitle, onDone, onSkip }: Props) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => setFriends(d.friends ?? []))
      .catch(() => {})
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const send = async () => {
    if (!selected.size || sending) return
    setSending(true)
    await Promise.all(
      Array.from(selected).map(toUserId =>
        fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUserId, filmId: String(filmId), note: note.trim() || null }),
        })
      )
    )
    setSent(true)
    setSending(false)
    setTimeout(onDone, 1200)
  }

  if (sent) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div className="stamp" style={{ display: 'inline-block', marginBottom: 12 }}>sent</div>
        <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)' }}>
          recommendation{selected.size > 1 ? 's' : ''} sent.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 40, padding: '28px 32px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 14 }}>
      <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 14 }}>★ RECOMMEND THIS TO SOMEONE</div>
      <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', fontFamily: 'var(--serif-italic)', marginBottom: 20, margin: '0 0 20px' }}>
        want to push <em>{filmTitle}</em> into a friend's thread?
      </p>

      {friends.length === 0 ? (
        <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          no friends yet — add some from the friends tab.
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
          {friends.map(f => {
            const isOn = selected.has(f.id)
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                style={{
                  padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: 'var(--serif-body)', fontSize: 14,
                  border: `1.5px solid ${isOn ? 'var(--ink)' : 'var(--paper-edge)'}`,
                  background: isOn ? 'var(--ink)' : 'var(--paper)',
                  color: isOn ? 'var(--paper)' : 'var(--ink)',
                  transition: 'all 150ms',
                }}
              >
                {f.name}
              </button>
            )
          })}
        </div>
      )}

      {selected.size > 0 && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="add a note… (optional)"
          rows={2}
          style={{
            width: '100%', padding: '12px 14px', marginBottom: 16,
            background: 'var(--paper)', border: '0.5px solid var(--paper-edge)',
            borderRadius: 8, fontFamily: 'var(--serif-italic)', fontStyle: 'italic',
            fontSize: 14, color: 'var(--ink)', outline: 'none', resize: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {selected.size > 0 && (
          <button
            className="btn"
            onClick={send}
            disabled={sending}
            style={{ padding: '10px 20px', fontSize: 13, borderRadius: 999, opacity: sending ? 0.5 : 1 }}
          >
            {sending ? 'sending…' : `recommend to ${selected.size === 1 ? friends.find(f => selected.has(f.id))?.name : `${selected.size} friends`} →`}
          </button>
        )}
        <button
          className="btn btn-soft"
          onClick={onSkip}
          style={{ padding: '10px 18px', fontSize: 13, borderRadius: 999 }}
        >
          skip
        </button>
      </div>
    </div>
  )
}
