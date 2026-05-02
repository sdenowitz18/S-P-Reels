'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DevResetButton() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'confirm' | 'resetting'>('idle')

  const reset = async () => {
    setState('resetting')
    await fetch('/api/dev/reset-account', { method: 'POST' })
    router.push('/onboarding')
    router.refresh()
  }

  if (state === 'resetting') {
    return (
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        padding: '8px 14px', borderRadius: 8,
        background: '#1a1a1a', color: '#888',
        fontFamily: 'monospace', fontSize: 11,
        border: '1px solid #333',
      }}>
        resetting…
      </div>
    )
  }

  if (state === 'confirm') {
    return (
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        padding: '10px 14px', borderRadius: 8,
        background: '#1a1a1a', color: '#fff',
        fontFamily: 'monospace', fontSize: 11,
        border: '1px solid #c0392b',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ color: '#888' }}>wipe account?</span>
        <button
          onClick={reset}
          style={{ background: '#c0392b', color: '#fff', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
        >
          yes
        </button>
        <button
          onClick={() => setState('idle')}
          style={{ background: 'none', color: '#888', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
        >
          cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setState('confirm')}
      title="DEV: reset account"
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        padding: '6px 10px', borderRadius: 7,
        background: '#1a1a1a', color: '#555',
        fontFamily: 'monospace', fontSize: 10,
        border: '1px solid #333',
        cursor: 'pointer', letterSpacing: '0.05em',
      }}
    >
      ⟳ reset
    </button>
  )
}
