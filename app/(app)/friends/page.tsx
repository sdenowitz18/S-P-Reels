'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/app-shell'

interface Friend { id: string; name: string; email: string }
interface IncomingRequest { id: string; to_email: string; status: string; from_user: Friend }
interface OutgoingRequest { id: string; to_email: string; status: string }

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string; link?: string } | null>(null)

  const load = () => {
    fetch('/api/friends')
      .then(r => r.json())
      .then(d => {
        setFriends(d.friends ?? [])
        setIncoming(d.incoming ?? [])
        setOutgoing(d.outgoing ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const sendInvite = async () => {
    if (!inviteEmail.trim() || inviting) return
    setInviting(true)
    setInviteResult(null)
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })
    const data = await res.json()
    setInviting(false)
    if (!res.ok) {
      setInviteResult({ ok: false, message: data.error })
    } else {
      setInviteEmail('')
      setInviteResult({
        ok: true,
        message: `invite link generated — copy it below and send it to them.`,
        link: data.inviteLink ?? undefined,
      })
      load()
    }
  }

  const accept = async (id: string) => {
    await fetch(`/api/friends/${id}/accept`, { method: 'POST' })
    load()
  }

  const decline = async (id: string) => {
    await fetch(`/api/friends/${id}/decline`, { method: 'POST' })
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
          invite someone by email. once they're on, you can recommend films to each other.
        </p>

        {/* Invite form */}
        <div style={{ padding: '24px 28px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 14, marginBottom: 36 }}>
          <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>INVITE SOMEONE</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendInvite() }}
              placeholder="their email address…"
              style={{ flex: 1, padding: '12px 14px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink)', outline: 'none' }}
            />
            <button
              onClick={sendInvite}
              disabled={!inviteEmail.trim() || inviting}
              className="btn"
              style={{ padding: '12px 20px', fontSize: 13, borderRadius: 999, opacity: !inviteEmail.trim() || inviting ? 0.5 : 1 }}
            >
              {inviting ? 'sending…' : 'invite →'}
            </button>
          </div>
          {inviteResult && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: inviteResult.ok ? 'var(--forest)' : 'var(--ink-2)', fontFamily: 'var(--serif-italic)' }}>
                {inviteResult.message}
              </p>
              {inviteResult.link && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    readOnly
                    value={inviteResult.link}
                    style={{ flex: 1, padding: '8px 12px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 6, fontFamily: 'var(--serif-body)', fontSize: 12, color: 'var(--ink-2)', outline: 'none' }}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    className="btn btn-soft"
                    style={{ padding: '8px 14px', fontSize: 12, borderRadius: 999, whiteSpace: 'nowrap' }}
                    onClick={() => navigator.clipboard.writeText(inviteResult.link!)}
                  >
                    copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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
                <div key={f.id} onClick={() => router.push(`/friends/${f.id}`)} style={{ padding: '16px 20px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
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
          <div>
            <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>PENDING INVITES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outgoing.map(req => (
                <div key={req.id} style={{ padding: '12px 18px', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--serif-body)', fontSize: 14, color: 'var(--ink-2)' }}>{req.to_email}</span>
                  <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>waiting…</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && friends.length === 0 && incoming.length === 0 && outgoing.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
              no connections yet — invite someone above.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
