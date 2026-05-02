'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

interface Friend { id: string; name: string; email: string }
interface IncomingRequest { id: string; to_email: string; status: string; from_user: Friend }
interface OutgoingRequest { id: string; to_email: string; to_user_id: string | null; status: string }

type SearchStatus = 'idle' | 'searching' | 'found' | 'already_friends' | 'already_requested' | 'not_found' | 'self'
interface SearchResult {
  status: SearchStatus
  user?: { id: string; name: string; email: string }
}

// ── Search panel ──────────────────────────────────────────────────────────────

function SearchPanel({ onRequestSent }: { onRequestSent: () => void }) {
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<SearchResult>({ status: 'idle' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) {
      setResult({ status: 'idle' })
      return
    }
    setResult({ status: 'searching' })
    try {
      const res = await fetch(`/api/friends/search?email=${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      setResult({ status: data.status as SearchStatus, user: data.user })
    } catch {
      setResult({ status: 'idle' })
    }
  }, [])

  const handleChange = (v: string) => {
    setEmail(v)
    setSent(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(v), 420)
  }

  const sendRequest = async () => {
    if (sending) return
    setSending(true)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSent(true)
        setResult(prev => ({ ...prev, status: 'already_requested' }))
        onRequestSent()
      }
    } finally {
      setSending(false)
    }
  }

  const clear = () => {
    setEmail('')
    setResult({ status: 'idle' })
    setSent(false)
  }

  return (
    <div style={{ padding: '24px 28px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, marginBottom: 36 }}>
      <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>FIND SOMEONE</div>

      <div style={{ position: 'relative' }}>
        <input
          type="email"
          value={email}
          onChange={e => handleChange(e.target.value)}
          placeholder="type their email address…"
          style={{
            width: '100%',
            padding: '12px 14px',
            paddingRight: email ? 36 : 14,
            background: 'var(--bone)',
            border: '0.5px solid var(--paper-edge)',
            borderRadius: 8,
            fontFamily: 'var(--serif-body)',
            fontSize: 15,
            color: 'var(--ink)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {email && (
          <button
            onClick={clear}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-4)', fontSize: 14, padding: 2, lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {/* Result area */}
      {result.status === 'searching' && (
        <p style={{ margin: '12px 0 0', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
          searching…
        </p>
      )}

      {result.status === 'self' && (
        <p style={{ margin: '12px 0 0', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
          that's you.
        </p>
      )}

      {result.status === 'found' && result.user && (
        <div style={{ marginTop: 14, padding: '16px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--s-tint)', color: 'var(--s-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 600, flexShrink: 0,
          }}>
            {result.user.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500 }}>{result.user.name}</div>
            <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 1 }}>{result.user.email}</div>
          </div>
          <button
            onClick={sendRequest}
            disabled={sending}
            className="btn"
            style={{ padding: '9px 18px', fontSize: 13, borderRadius: 999, flexShrink: 0, opacity: sending ? 0.6 : 1 }}
          >
            {sending ? 'sending…' : 'send request →'}
          </button>
        </div>
      )}

      {result.status === 'already_friends' && (
        <div style={{ marginTop: 14, padding: '14px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'var(--serif-display)', fontSize: 14, color: 'var(--ink-2)', flex: 1 }}>
            you're already friends with this person.
          </div>
        </div>
      )}

      {result.status === 'already_requested' && (
        <div style={{ marginTop: 14, padding: '14px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--forest)', fontFamily: 'var(--serif-italic)', flex: 1 }}>
            {sent ? 'request sent — they\'ll see it when they next open the app.' : 'you\'ve already sent this person a request.'}
          </div>
        </div>
      )}

      {result.status === 'not_found' && (
        <div style={{ marginTop: 14 }}>
          {!sent ? (
            <>
              <p style={{ margin: '0 0 12px', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                not on S&P Reels yet — we'll send them an email invitation.
              </p>
              <button
                onClick={sendRequest}
                disabled={sending}
                className="btn btn-soft"
                style={{ padding: '9px 18px', fontSize: 13, borderRadius: 999, opacity: sending ? 0.6 : 1 }}
              >
                {sending ? 'sending…' : 'send invite →'}
              </button>
            </>
          ) : (
            <div style={{ padding: '14px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 10 }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--forest)', fontFamily: 'var(--serif-italic)' }}>
                invite sent — they'll get an email to create an account and join you here.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const load = useCallback(() => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => {
        setFriends(d.friends ?? [])
        setIncoming(d.incoming ?? [])
        setOutgoing(d.outgoing ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const accept = async (id: string) => {
    await fetch(`/api/friends/${id}/accept`, { method: 'POST' })
    load()
  }

  const decline = async (id: string) => {
    await fetch(`/api/friends/${id}/decline`, { method: 'POST' })
    load()
  }

  const rescind = async (id: string) => {
    await fetch(`/api/friends/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <AppShell active="friends">
      <div style={{ padding: '56px 64px', maxWidth: 760, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ FRIENDS</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>
          your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>people</span>.
        </h1>
        <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-2)', marginTop: 14, lineHeight: 1.5, fontFamily: 'var(--serif-italic)', maxWidth: 480, marginBottom: 40 }}>
          find someone by email — if they're on S&P Reels, send them a request directly.
        </p>

        <SearchPanel onRequestSent={load} />

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>WAITING FOR YOU</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {incoming.map(req => (
                <div key={req.id} style={{ padding: '18px 22px', background: 'var(--p-tint)', border: '0.5px solid var(--p-ink)40', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--p-ink)20', color: 'var(--p-ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 600, flexShrink: 0,
                  }}>
                    {req.from_user?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500 }}>{req.from_user?.name ?? req.to_email}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>{req.from_user?.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => accept(req.id)} className="btn" style={{ padding: '8px 16px', fontSize: 12, borderRadius: 999 }}>accept</button>
                    <button onClick={() => decline(req.id)} className="btn btn-soft" style={{ padding: '8px 12px', fontSize: 12, borderRadius: 999 }}>decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friend list */}
        {friends.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>YOUR FRIENDS · {friends.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {friends.map(f => (
                <div
                  key={f.id}
                  onClick={() => router.push(`/friends/${f.id}`)}
                  style={{ padding: '16px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--s-tint)', color: 'var(--s-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
                    {f.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500 }}>{f.name}</div>
                    <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>{f.email}</div>
                  </div>
                  <span style={{ fontSize: 16, color: 'var(--ink-3)' }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing pending */}
        {outgoing.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>PENDING</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outgoing.map(req => (
                <div key={req.id} style={{ padding: '12px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink-2)' }}>{req.to_email}</span>
                  <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>waiting…</span>
                  <button
                    onClick={() => rescind(req.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)',
                      letterSpacing: '0.04em', padding: '2px 6px',
                      borderRadius: 4, transition: 'color 120ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--p-ink)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-4)' }}
                    title="rescind request"
                  >
                    rescind
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <div style={{ padding: '40px 0' }}>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              no connections yet — find someone above.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
