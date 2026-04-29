'use client'

interface DimBarProps {
  neg: string
  pos: string
  myVal: number              // -1 to 1
  myName?: string
  myColor?: string
  theirVal?: number          // optional — present on blend view
  theirName?: string
  theirColor?: string
}

export function DimBar({
  neg, pos,
  myVal, myName, myColor = 'var(--s-ink)',
  theirVal, theirName, theirColor = 'var(--p-ink)',
}: DimBarProps) {
  const myPct    = ((myVal + 1) / 2) * 100
  const theirPct = theirVal != null ? ((theirVal + 1) / 2) * 100 : null
  const hasTwo   = theirPct != null

  return (
    <div style={{ margin: '20px 0 24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr 76px', gap: 12, alignItems: 'center' }}>

        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)',
          textAlign: 'right', letterSpacing: '0.02em',
        }}>
          {neg}
        </span>

        <div>
          {/* Track + dots */}
          <div style={{ height: 3, background: 'var(--paper-3)', borderRadius: 2, position: 'relative' }}>
            {theirPct != null && (
              <div style={{
                position: 'absolute', left: `${theirPct}%`,
                top: '50%', transform: 'translate(-50%, -50%)',
                width: 11, height: 11, borderRadius: '50%',
                background: theirColor, border: '2px solid var(--paper)', zIndex: 1,
              }} />
            )}
            <div style={{
              position: 'absolute', left: `${myPct}%`,
              top: '50%', transform: 'translate(-50%, -50%)',
              width: 11, height: 11, borderRadius: '50%',
              background: myColor, border: '2px solid var(--paper)', zIndex: 2,
            }} />
          </div>

          {/* Name labels under dots — only on blend view */}
          {hasTwo && (myName || theirName) && (
            <div style={{ position: 'relative', height: 18, marginTop: 7 }}>
              {myName && (
                <span style={{
                  position: 'absolute', left: `${myPct}%`, transform: 'translateX(-50%)',
                  fontFamily: 'var(--mono)', fontSize: 8, color: myColor,
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>
                  {myName.split(' ')[0]}
                </span>
              )}
              {theirName && theirPct != null && (
                <span style={{
                  position: 'absolute', left: `${theirPct}%`, transform: 'translateX(-50%)',
                  fontFamily: 'var(--mono)', fontSize: 8, color: theirColor,
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>
                  {theirName.split(' ')[0]}
                </span>
              )}
            </div>
          )}
        </div>

        <span style={{
          fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-4)',
          letterSpacing: '0.02em',
        }}>
          {pos}
        </span>
      </div>
    </div>
  )
}
