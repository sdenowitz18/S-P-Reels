'use client'
import { useState, useRef, useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Wordmark } from './wordmark'
import { NavPills } from './nav-pills'
import { fetcher } from '@/lib/fetcher'
import { useIsMobile } from '@/lib/use-is-mobile'

interface AppShellProps {
  active?: string
  children: React.ReactNode
  withAdd?: boolean
  counts?: Record<string, number>
}

interface Notification {
  id: string
  type: string
  read: boolean
  created_at: string
  from_user: { id: string; name: string } | null
  rec: { id: string; film: { title: string } | null } | null
}

export function AppShell({ active, children, withAdd = true, counts: countsProp }: AppShellProps) {
  const isMobile = useIsMobile()
  const { data, mutate } = useSWR('/api/notifications', fetcher)
  const notifications: Notification[] = data?.notifications ?? []
  const [unread, setUnread] = useState(0)

  useEffect(() => { if (data?.unread != null) setUnread(data.unread) }, [data?.unread])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <TopBar
        active={active}
        counts={countsProp}
        notifications={notifications}
        unread={unread}
        isMobile={isMobile}
        onNotificationsRead={() => setUnread(0)}
        onNotificationsLoaded={() => mutate()}
      />
      {children}
      {isMobile
        ? <MobileBottomNav active={active} unread={unread} />
        : withAdd && <FloatingAdd />
      }
    </div>
  )
}

function TopBar({
  active, counts, notifications, unread, isMobile, onNotificationsRead, onNotificationsLoaded,
}: {
  active?: string
  counts?: Record<string, number>
  notifications: Notification[]
  unread: number
  isMobile: boolean
  onNotificationsRead: () => void
  onNotificationsLoaded: () => void
}) {
  return (
    <header style={{
      padding: isMobile ? '14px 18px' : '18px 36px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '0.5px solid var(--paper-edge)',
      background: '#ffffff',
      gap: 24, position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Wordmark />
        {!isMobile && <TastePill />}
      </div>
      {!isMobile && <NavPills active={active} counts={counts} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
        <NotificationBell
          unread={unread}
          notifications={notifications}
          onRead={onNotificationsRead}
          onRefresh={onNotificationsLoaded}
        />
        <AccountPill />
      </div>
    </header>
  )
}

// ── Notification bell ─────────────────────────────────────────────────────────

function notificationText(n: Notification): { headline: string; sub: string } {
  const name = n.from_user?.name ?? 'someone'
  switch (n.type) {
    case 'rec_received':
      return {
        headline: `${name} recommended a film`,
        sub: n.rec?.film?.title ?? '',
      }
    case 'friend_request':
      return {
        headline: `${name} wants to be friends`,
        sub: 'tap to accept or decline',
      }
    case 'friend_request_accepted':
      return {
        headline: `${name} accepted your request`,
        sub: 'you\'re now connected',
      }
    default:
      return { headline: 'new notification', sub: '' }
  }
}

function notificationHref(n: Notification): string {
  switch (n.type) {
    case 'rec_received':         return '/recommended'
    case 'friend_request':       return '/friends'
    case 'friend_request_accepted': return '/friends'
    default:                     return '/friends'
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotificationBell({ unread, notifications, onRead, onRefresh }: {
  unread: number
  notifications: Notification[]
  onRead: () => void
  onRefresh: () => void
}) {
  const router  = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleOpen = async () => {
    const opening = !open
    setOpen(o => !o)
    if (opening && unread > 0) {
      onRead()
      await fetch('/api/notifications', { method: 'PATCH' })
    }
  }

  const handleClick = (n: Notification) => {
    setOpen(false)
    router.push(notificationHref(n))
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        aria-label="notifications"
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: open ? 'var(--s-tint)' : 'transparent',
          border: `0.5px solid ${open ? 'var(--s-ink)' : 'var(--paper-edge)'}`,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: open ? 'var(--s-ink)' : 'var(--ink-3)',
          transition: 'all 150ms',
          position: 'relative',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--s-ink)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--s-ink)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--s-tint)'
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }
        }}
      >
        {/* Bell icon */}
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
          <path d="M7.5 1.5C5.01 1.5 3 3.51 3 6v3.5L1.5 11h12L12 9.5V6c0-2.49-2.01-4.5-4.5-4.5z"
            stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinejoin="round" />
          <path d="M6 11.5c0 .83.67 1.5 1.5 1.5S9 12.33 9 11.5"
            stroke="currentColor" strokeWidth="0.9" fill="none" />
        </svg>

        {/* Unread badge */}
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--p-ink)',
            border: '1.5px solid #ffffff',
          }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          width: 320,
          background: 'var(--paper)',
          border: '0.5px solid var(--paper-edge)',
          borderRadius: 12,
          boxShadow: '0 18px 40px -16px rgba(40,20,10,.4)',
          overflow: 'hidden',
          zIndex: 100,
        }}>
          <div style={{
            padding: '14px 18px 10px',
            borderBottom: '0.5px solid var(--paper-edge)',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)' }}>★ NOTIFICATIONS</span>
            <button
              onClick={() => { onRefresh(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em' }}
            >
              refresh
            </button>
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--serif-italic)' }}>
                  all clear.
                </p>
              </div>
            ) : (
              notifications.map((n, i) => {
                const { headline, sub } = notificationText(n)
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '14px 18px',
                      background: n.read ? 'transparent' : 'var(--s-tint)08',
                      border: 'none',
                      borderBottom: i < notifications.length - 1 ? '0.5px solid var(--paper-edge)' : 'none',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bone)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = n.read ? 'transparent' : 'var(--s-tint)08' }}
                  >
                    {/* Avatar initial */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      background: 'var(--s-tint)', color: 'var(--s-ink)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--serif-display)', fontSize: 13, fontWeight: 600,
                    }}>
                      {n.from_user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--serif-body)', fontSize: 13.5, color: 'var(--ink)',
                        lineHeight: 1.4,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>{headline}</span>
                        {!n.read && (
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: 'var(--p-ink)', flexShrink: 0, display: 'inline-block',
                          }} />
                        )}
                      </div>
                      {sub && (
                        <div style={{ fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 2 }}>
                          {sub}
                        </div>
                      )}
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-4)', letterSpacing: '0.04em', marginTop: 4 }}>
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Taste pill ────────────────────────────────────────────────────────────────

function TastePill() {
  const router = useRouter()
  const pathname = usePathname()
  const isActive = pathname === '/taste-code' || pathname.startsWith('/onboarding/reveal')
  const { data } = useSWR('/api/profile/taste', fetcher)
  const code = data?.tasteCode?.entries?.map((e: { letter: string }) => e.letter).join('') ?? null

  return (
    <button
      onClick={() => router.push('/profile')}
      title={code ? `Your taste code: ${code}` : 'Your taste profile'}
      aria-label="Taste profile"
      style={{
        height: 34, borderRadius: 8,
        padding: '0 6px',
        background: isActive ? 'var(--s-tint)' : 'transparent',
        border: `0.5px solid ${isActive ? 'var(--s-ink)' : 'var(--paper-edge)'}`,
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 3,
        transition: 'all 150ms',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--s-ink)'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--s-tint)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--paper-edge)'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {code ? (
        // 4 mini letter tiles matching the profile page block style
        code.split('').map((letter: string, i: number) => (
          <span key={i} style={{
            width: 22, height: 22,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '0.5px solid var(--paper-edge)',
            borderRadius: 4,
            background: 'var(--paper)',
            fontFamily: 'var(--serif-display)',
            fontSize: 13, fontWeight: 600, lineHeight: 1,
            color: 'var(--ink)',
          }}>
            {letter}
          </span>
        ))
      ) : (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          color: isActive ? 'var(--s-ink)' : 'var(--ink-4)',
          letterSpacing: '0.04em',
        }}>
          ★
        </span>
      )}
    </button>
  )
}

// ── Account pill ──────────────────────────────────────────────────────────────

function AccountPill() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: meData } = useSWR('/api/auth/me', fetcher)
  const name = meData?.name ?? ''
  const initial = name ? name[0].toUpperCase() : '·'

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
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

// ── Floating add ──────────────────────────────────────────────────────────────

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

// ── Mobile bottom nav ─────────────────────────────────────────────────────────

const MOBILE_TABS = [
  { id: 'movies',      label: 'watched',    href: '/movies',      icon: '★' },
  { id: 'now',         label: 'now',        href: '/now-playing', icon: '◐' },
  { id: 'watch',       label: 'list',       href: '/watch-list',  icon: '○' },
  { id: 'mood',        label: 'mood',       href: '/mood',        icon: '◉' },
  { id: 'friends',     label: 'friends',    href: '/friends',     icon: '♦' },
  { id: 'add',         label: 'add',        href: '/add',         icon: '+' },
]

function MobileBottomNav({ active, unread }: { active?: string; unread: number }) {
  const pathname = usePathname()
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: '#ffffff',
      borderTop: '0.5px solid var(--paper-edge)',
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {MOBILE_TABS.map(tab => {
        const isActive = active === tab.id || pathname === tab.href
        const isAdd = tab.id === 'add'
        return (
          <Link
            key={tab.id}
            href={tab.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px',
              textDecoration: 'none',
              background: isAdd ? 'var(--ink)' : 'transparent',
              borderLeft: isAdd ? '0.5px solid var(--paper-edge)' : 'none',
              position: 'relative',
            }}
          >
            {tab.id === 'friends' && unread > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: '50%', transform: 'translateX(8px)',
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--p-ink)', border: '1.5px solid #fff',
              }} />
            )}
            <span style={{
              fontFamily: 'var(--serif-display)', fontSize: 15,
              color: isAdd ? 'var(--paper)' : isActive ? 'var(--ink)' : 'var(--ink-4)',
              lineHeight: 1, marginBottom: 3,
            }}>{tab.icon}</span>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: isAdd ? 'var(--paper)' : isActive ? 'var(--ink)' : 'var(--ink-4)',
            }}>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
