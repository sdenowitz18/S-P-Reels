import { AppShell } from '@/components/app-shell'

export default function MoviesLoading() {
  return (
    <AppShell active="movies">
      <div style={{ padding: '56px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ width: 60, height: 10, background: 'var(--paper-2)', borderRadius: 4, marginBottom: 14 }} />
          <div style={{ width: 320, height: 48, background: 'var(--paper-2)', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '32px 18px' }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i}>
              <div style={{ width: '100%', aspectRatio: '2/3', background: 'var(--paper-2)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 80}ms` }} />
              <div style={{ height: 12, background: 'var(--paper-2)', borderRadius: 3, marginTop: 10, width: '80%' }} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
