'use client'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { UserTasteTag, UserProfile } from '@/lib/types'

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tags, setTags] = useState<UserTasteTag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/profile/taste-tags').then(r => r.json()).catch(() => []),
    ]).then(([p, t]) => {
      setProfile(p)
      setTags(Array.isArray(t) ? t : [])
      setLoading(false)
    })
  }, [])

  return (
    <AppShell>
      <div style={{ padding: '56px 64px', maxWidth: 760, margin: '0 auto' }}>
        <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ YOUR PROFILE</div>
        <h1 className="t-display" style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>
          your <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--s-ink)' }}>taste</span>.
        </h1>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', marginTop: 24 }}>loading…</p>
        )}

        {!loading && profile && (
          <>
            <div style={{ marginTop: 36, padding: '24px 28px', background: 'var(--paper-2)', border: '0.5px solid var(--paper-edge)', borderRadius: 12 }}>
              <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 10 }}>ACCOUNT</div>
              <div style={{ fontFamily: 'var(--serif-display)', fontSize: 22, fontWeight: 500 }}>{profile.name}</div>
              <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--serif-italic)' }}>{profile.email}</div>
            </div>

            {tags.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 14 }}>YOUR TASTE TAGS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.sort((a, b) => b.weight - a.weight).map(t => (
                    <span key={t.tag} style={{
                      padding: '7px 14px', borderRadius: 999,
                      background: 'var(--s-tint)', border: '0.5px solid var(--s-ink)50',
                      fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--s-ink)',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {t.tag.replace(/-/g, ' ')}
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, opacity: 0.6 }}>×{t.weight}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {tags.length === 0 && (
              <div style={{ marginTop: 32 }}>
                <div className="t-meta" style={{ fontSize: 9, color: 'var(--ink-3)', marginBottom: 12 }}>YOUR TASTE TAGS</div>
                <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
                  log a film and do the interview — your taste tags will show up here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}
