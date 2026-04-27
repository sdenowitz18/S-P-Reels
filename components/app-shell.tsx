'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Wordmark } from './wordmark'
import { NavPills } from './nav-pills'

interface AppShellProps {
  active?: string
  children: React.ReactNode
  withAdd?: boolean
  counts?: Record<string, number>
}

export function AppShell({ active, children, withAdd = true, counts: countsProp }: AppShellProps) {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      if (typeof d.unread === 'number') setUnread(d.unread)
    }).catch(() => {})
  }, [])

  const counts = { ...countsProp, ...(unread > 0 ? { friends: unread } : {}) }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <TopBar active={active} counts={counts} />
      {children}
      {withAdd && <FloatingAdd />}
    </div>
  )
}

function TopBar({ active, counts }: { active?: string; counts?: Record<string, number> }) {
  return (
    <header style={{
      padding: '18px 36px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '0.5px solid var(--paper-edge)',
      background: '#ffffff',
      gap: 24, position: 'sticky', top: 0, zIndex: 10,
    }}>
      <Wordmark />
      <NavPills active={active} counts={counts} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 100, justifyContent: 'flex-end' }}>
        <AccountPill />
      </div>
    </header>
  )
}

function AccountPill() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [initial, setInitial] = useState('·')
  const [name, setName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.name) { setName(d.name); setInitial(d.name[0].toUpperCase()) }
    }).catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/signin')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="account" style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'var(--s-tint)', color: 'var(--s-ink)',
        border: '0.5px solid var(--paper-edge)', cursor: 'pointer',
        fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{initial}</button>
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 200,
          background: 'var(--paper)', border: '0.5px solid var(--paper-edge)',
          borderRadius: 10, boxShadow: '0 18px 40px -16px rgba(40,20,10,.4)',
          padding: '12px 14px', zIndex: 100,
        }}>
          {name && <div style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>{name}</div>}
          <button onClick={() => { setOpen(false); router.push('/profile') }} style={{
            width: '100%', textAlign: 'left', padding: '8px 6px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--serif-body)', fontSize: 13.5, color: 'var(--ink)', borderRadius: 6,
          }}>go to profile</button>
          <hr style={{ border: 0, borderTop: '0.5px solid var(--paper-edge)', margin: '8px 0' }} />
          <button onClick={handleSignOut} style={{
            width: '100%', textAlign: 'left', padding: '8px 6px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--serif-body)', fontSize: 13.5, color: 'var(--ink-3)', borderRadius: 6,
          }}>log out</button>
        </div>
      )}
    </div>
  )
}

function FloatingAdd() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const items = [
    { label: "log something i've watched", sub: "a film or show — finished or mid-reel, we'll route it", href: '/add' },
    { label: 'recommend to a friend',      sub: "push a film into a friend's thread",                   href: '/recommend' },
    { label: 'find something to watch',    sub: 'open the mood room',                                   href: '/mood' },
    { label: 'save for later',             sub: 'add to the watch list',                                href: '/watch-list/save' },
  ]

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: 36, right: 36, zIndex: 50 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 70, right: 0,
          width: 280, padding: '14px 16px',
          background: 'var(--paper)',
          border: '0.5px solid var(--paper-edge)',
          borderRadius: 12,
          boxShadow: '0 18px 40px -16px rgba(40,20,10,.4)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 2 }}>★ ADD ANYTHING — THE THREE PATHS</div>
          {items.map((it) => (
            <button
              key={it.href}
              onClick={() => { setOpen(false); router.push(it.href) }}
              style={{
                textAlign: 'left', cursor: 'pointer',
                padding: '10px 12px', borderRadius: 8,
                border: '0.5px solid var(--paper-edge)',
                background: 'var(--bone)',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{it.label}</span>
              <span style={{ fontStyle: 'italic', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>{it.sub}</span>
            </button>
          ))}
        </div>
      )}
      <button
        aria-label="add"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--ink)', color: 'var(--paper)', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--serif-display)', fontSize: 28, lineHeight: 1, fontWeight: 300,
          boxShadow: '0 8px 20px -8px rgba(40,20,10,.5)',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform 200ms',
        }}
      >+</button>
    </div>
  )
}
