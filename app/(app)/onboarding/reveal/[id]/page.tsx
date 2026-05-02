'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteCode, TasteCodeEntry, ALL_POLES } from '@/lib/taste-code'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RevealData {
  tasteCode: TasteCode
  filmCount: number
}

interface TastePreview {
  allLetters: Array<{ letter: string; gap: number; locked: boolean }>
  filmCount: number
}

// ── Prose builder ─────────────────────────────────────────────────────────────

function buildProse(entries: TasteCodeEntry[]): string {
  if (!entries.length) return ''
  return entries.slice(0, 3).map((e, i) => {
    if (i === 0) return e.description
    const d = e.description
    const prefix = i === 1 ? 'also ' : 'and '
    if (d.startsWith("You're "))      return `You're ${prefix}${d.slice(7)}`
    if (d.startsWith("You like "))    return `You ${prefix}like ${d.slice(9)}`
    if (d.startsWith("You prefer "))  return `You ${prefix}prefer ${d.slice(11)}`
    if (d.startsWith("You respond ")) return `You ${prefix}respond ${d.slice(12)}`
    if (d.startsWith("You want "))    return `You ${prefix}want ${d.slice(9)}`
    if (d.startsWith("You are "))     return `You are ${prefix}${d.slice(8)}`
    return d
  }).join(' ')
}

// ── Dimension display names ───────────────────────────────────────────────────

const DIM_NAMES: Record<string, string> = {
  narrative_legibility:    'Narrative Legibility',
  emotional_directness:    'Emotional Directness',
  plot_vs_character:       'Plot vs Character',
  naturalistic_vs_stylized:'Visual Style',
  narrative_closure:       'Narrative Closure',
  intimate_vs_epic:        'Scale',
  accessible_vs_demanding: 'Accessibility',
  psychological_safety:    'Emotional Safety',
  moral_clarity:           'Moral Clarity',
  behavioral_realism:      'Character Realism',
  kinetic_vs_patient:      'Pacing',
  sensory_vs_intellectual: 'Sensory vs Intellectual',
}

// ── Preference phrase ─────────────────────────────────────────────────────────

function preferenceVerb(gap: number): string {
  if (gap >= 50) return 'strongly prefer'
  if (gap >= 35) return 'really prefer'
  if (gap >= 20) return 'lean toward'
  if (gap >= 10) return 'slightly lean toward'
  return 'barely lean toward'
}

// ── Spectrum bar — user's letter always LEFT, marker leans left ───────────────

function SpectrumBar({ entry }: { entry: TasteCodeEntry }) {
  const leftLetter  = entry.letter
  const leftLabel   = entry.label
  const leftScore   = entry.poleScore
  const rightLetter = entry.oppLetter
  const rightLabel  = entry.oppLabel
  const rightScore  = entry.oppositeScore
  const markerPct   = Math.round((rightScore / (leftScore + rightScore)) * 100)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
          {leftLetter} · {leftLabel}
        </span>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
          {rightLabel} · {rightLetter}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4, borderRadius: 999, background: 'var(--paper-edge)' }}>
        <div style={{
          position: 'absolute', top: '50%', left: `${markerPct}%`,
          transform: 'translate(-50%, -50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)', border: '3px solid var(--paper)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          transition: 'left 600ms ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{leftScore}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{rightScore}</span>
      </div>
    </div>
  )
}

// ── Film grid ─────────────────────────────────────────────────────────────────

function FilmGrid({ films }: { films: TasteCodeEntry['sampleFilms'] }) {
  if (!films.length) return null
  return (
    <div>
      <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 18 }}>
        films that shaped this
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {films.slice(0, 6).map((f, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 90, height: 126, borderRadius: 8, overflow: 'hidden', background: 'var(--bone)', border: '0.5px solid var(--paper-edge)', flexShrink: 0 }}>
              {f.poster_path && (
                <Image src={f.poster_path} alt={f.title} width={90} height={126}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <span style={{ fontFamily: 'var(--serif-body)', fontSize: 13, color: 'var(--ink-3)' }}>
              {'★'.repeat(Math.round(f.stars))}
            </span>
            <span style={{ fontFamily: 'var(--serif-body)', fontSize: 11, fontStyle: 'italic', color: 'var(--ink-4)', maxWidth: 90, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {f.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ entry, maxWidth }: { entry: TasteCodeEntry; maxWidth?: number }) {
  const poleDef = ALL_POLES.find(p => p.dimKey === entry.dimKey && p.pole === entry.pole)
  const mw = maxWidth ?? 680
  const dimName = DIM_NAMES[entry.dimKey] ?? entry.dimKey.replace(/_/g, ' ')
  const verb = preferenceVerb(entry.gap)

  return (
    <div style={{ borderTop: '0.5px solid var(--paper-edge)', paddingTop: 36, marginTop: 8 }}>

      {/* Dimension name — prominent */}
      <p style={{ fontFamily: 'var(--serif-display)', fontSize: 26, fontWeight: 500, color: 'var(--ink)', textAlign: 'center', margin: '0 auto 8px', maxWidth: mw, lineHeight: 1.2 }}>
        {dimName}
      </p>

      {/* Dimension description */}
      {poleDef?.dimDescription && (
        <p style={{ fontFamily: 'var(--serif-body)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.7, margin: '0 auto 28px', maxWidth: mw, textAlign: 'center' }}>
          {poleDef.dimDescription}
        </p>
      )}

      {/* Spectrum bar */}
      <div style={{ margin: '0 auto 36px', maxWidth: mw }}>
        <SpectrumBar entry={entry} />
      </div>

      {/* Preference callout — "you really prefer Familiar over Demanding" */}
      <p style={{ fontFamily: 'var(--serif-body)', fontSize: 17, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.6, margin: '0 auto 20px', maxWidth: mw, textAlign: 'center' }}>
        you {verb}{' '}
        <span style={{ fontFamily: 'var(--serif-display)', fontStyle: 'normal', fontWeight: 600, fontSize: 19, color: 'var(--ink)' }}>
          {entry.label}
        </span>
        {' '}over{' '}
        <span style={{ color: 'var(--ink-4)', fontStyle: 'normal' }}>
          {entry.oppLabel}
        </span>
      </p>

      {/* Description prose */}
      <p style={{ fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, margin: '0 auto 44px', maxWidth: mw, textAlign: 'center' }}>
        {entry.description}
      </p>

      <FilmGrid films={entry.sampleFilms} />
    </div>
  )
}

// ── Letter block ──────────────────────────────────────────────────────────────
// size: 'large' (page 0 primary) | 'medium' (page 1 secondary) | 'small' (unused)
// blockState: 'idle' | 'active' | 'seen' | 'nav'
// signalTier: controls idle background shading ('strong' | 'moderate' | 'weak')

function LetterBlock({
  entry,
  blockState,
  size = 'large',
  signalTier,
  onClick,
}: {
  entry: TasteCodeEntry
  blockState: 'idle' | 'active' | 'seen' | 'nav'
  size?: 'large' | 'medium' | 'small'
  signalTier?: 'strong' | 'moderate' | 'weak'
  onClick: () => void
}) {
  const dim = {
    large:  { w: 112, h: 138, fs: 52, labelFs: 9 },
    medium: { w: 88,  h: 108, fs: 42, labelFs: 9 },
    small:  { w: 52,  h: 64,  fs: 26, labelFs: 0 },
  }[size]

  // Idle background respects signal tier shading
  const idleBg =
    signalTier === 'strong'   ? 'var(--bone)' :
    signalTier === 'moderate' ? 'var(--paper)' :
    signalTier === 'weak'     ? 'transparent' :
    'var(--paper)'

  const bg =
    blockState === 'seen'   ? '#e8f5ee' :
    blockState === 'active' ? 'var(--bone)' :
    idleBg

  const borderStyle =
    blockState === 'seen'   ? '1.5px solid #52b788' :
    blockState === 'active' ? '1.5px solid var(--ink)' :
    signalTier === 'strong' ? '1px solid var(--paper-edge)' :
    '0.5px solid var(--paper-edge)'

  const letterColor =
    blockState === 'seen' ? '#2d6a4f' :
    blockState === 'nav'  ? 'var(--ink-4)' :
    'var(--ink)'

  const labelColor =
    blockState === 'seen' ? '#52b788' :
    blockState === 'nav'  ? 'var(--ink-4)' :
    'var(--ink-3)'

  const showLabel = size === 'large' || size === 'medium'

  return (
    <div onClick={onClick} title={entry.label} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        width: dim.w, height: dim.h,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, border: borderStyle, borderRadius: 12,
        background: bg, transition: 'all 200ms ease',
        userSelect: 'none', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--serif-display)', fontSize: dim.fs, fontWeight: 500, lineHeight: 1, color: letterColor }}>
          {entry.letter}
        </span>
        {showLabel && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: dim.labelFs, letterSpacing: '0.07em', textTransform: 'uppercase', color: labelColor }}>
            {entry.label}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Page 0: 4-letter moment (centered) ───────────────────────────────────────

function LetterMomentPage({
  data,
  onNext,
  selectedLetter,
  seenLetters,
  onSelectLetter,
}: {
  data: RevealData
  onNext: () => void
  selectedLetter: string | null
  seenLetters: Set<string>
  onSelectLetter: (letter: string) => void
}) {
  const entries     = data.tasteCode.entries
  const prose       = buildProse(entries)
  const allSeen     = seenLetters.size >= entries.length
  const activeEntry = entries.find(e => e.letter === selectedLetter) ?? null

  return (
    <div style={{ padding: '56px 7% 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* Prose — centered, wide */}
      <p style={{ fontFamily: 'var(--serif-body)', fontSize: 18, lineHeight: 1.85, color: 'var(--ink)', margin: '0 0 52px', maxWidth: 820, textAlign: 'center' }}>
        {prose}
      </p>

      {/* Letters + "see more" button in one row, centered */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 18, justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {entries.map(e => (
            <LetterBlock
              key={e.letter}
              entry={e}
              blockState={
                selectedLetter === e.letter ? 'active' :
                seenLetters.has(e.letter)   ? 'seen'   : 'idle'
              }
              size="large"
              onClick={() => onSelectLetter(e.letter)}
            />
          ))}
        </div>

        {/* Button beside the blocks */}
        <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <button
            onClick={allSeen ? onNext : undefined}
            style={{
              fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
              color: allSeen ? 'var(--ink)' : 'var(--ink-4)',
              background: allSeen ? 'var(--bone)' : 'transparent',
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 8, cursor: allSeen ? 'pointer' : 'default',
              opacity: allSeen ? 1 : 0.35,
              transition: 'all 500ms ease',
              padding: '10px 18px', whiteSpace: 'nowrap',
            }}
          >
            see more dimensions →
          </button>
          {!allSeen && (
            <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.05em', color: 'var(--ink-4)', margin: '8px 0 0', textAlign: 'center' }}>
              tap all {entries.length} to unlock
            </p>
          )}
        </div>
      </div>

      {/* Hint (only when nothing selected) */}
      {!activeEntry && (
        <div style={{ minHeight: 22, marginBottom: 6, textAlign: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--ink-4)' }}>
            tap each letter to explore it
          </span>
        </div>
      )}

      {/* Detail panel — full content width */}
      {activeEntry && (
        <div style={{ width: '100%' }}>
          <DetailPanel entry={activeEntry} maxWidth={720} />
        </div>
      )}
    </div>
  )
}

// ── Page 1: Full breakdown (centered, one row, shaded groups) ─────────────────

function BreakdownPage({
  data,
  onBack,
  onNext,
}: {
  data: RevealData
  onBack: (letter: string) => void
  onNext: () => void
}) {
  const topEntries = data.tasteCode.entries
  const topLetters = new Set(topEntries.map(e => e.letter))
  const allOthers  = data.tasteCode.allEntries.filter(e => !topLetters.has(e.letter))

  const strong   = allOthers.filter(e => e.gap >= 35)
  const moderate = allOthers.filter(e => e.gap >= 15 && e.gap < 35)
  const weak     = allOthers.filter(e => e.gap < 15)

  const [selectedDimKey, setSelectedDimKey] = useState<string | null>(null)
  const [seenDimKeys,    setSeenDimKeys]    = useState<Set<string>>(new Set())
  const activeEntry = allOthers.find(e => e.dimKey === selectedDimKey) ?? null
  const allSeen     = seenDimKeys.size >= allOthers.length
  const toggle = (dimKey: string) => {
    setSelectedDimKey(prev => prev === dimKey ? null : dimKey)
    setSeenDimKeys(prev => new Set([...prev, dimKey]))
  }

  return (
    <div style={{ padding: '56px 7% 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      {/* 4 grayed nav letters — centered, with "strong preference" label below each */}
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 14 }}>
          your core identity — tap to revisit
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          {topEntries.map(e => (
            <div key={e.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <LetterBlock entry={e} blockState="nav" size="large" onClick={() => onBack(e.letter)} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
                {e.gap >= 35 ? 'strong preference' : e.gap >= 15 ? 'preference' : 'light preference'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* All 8 secondary dimensions — one horizontal flow, label BELOW each block, "what's next" button to the right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, justifyContent: 'center', marginBottom: 48, width: '100%' }}>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {strong.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {strong.map(e => (
                <div key={e.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <LetterBlock entry={e} blockState={selectedDimKey === e.dimKey ? 'active' : seenDimKeys.has(e.dimKey) ? 'seen' : 'idle'} size="medium" signalTier="strong" onClick={() => toggle(e.dimKey)} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>strong preference</span>
                </div>
              ))}
            </div>
          )}
          {moderate.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {moderate.map(e => (
                <div key={e.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <LetterBlock entry={e} blockState={selectedDimKey === e.dimKey ? 'active' : seenDimKeys.has(e.dimKey) ? 'seen' : 'idle'} size="medium" signalTier="moderate" onClick={() => toggle(e.dimKey)} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>preference</span>
                </div>
              ))}
            </div>
          )}
          {weak.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {weak.map(e => (
                <div key={e.letter} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <LetterBlock entry={e} blockState={selectedDimKey === e.dimKey ? 'active' : seenDimKeys.has(e.dimKey) ? 'seen' : 'idle'} size="medium" signalTier="weak" onClick={() => toggle(e.dimKey)} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>light preference</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* "What's next" button — to the right, lights up when all seen */}
        <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={allSeen ? onNext : undefined}
            style={{
              fontFamily: 'var(--serif-display)', fontSize: 14, fontWeight: 500,
              color: allSeen ? 'var(--ink)' : 'var(--ink-4)',
              background: allSeen ? 'var(--bone)' : 'transparent',
              border: '0.5px solid var(--paper-edge)',
              borderRadius: 8, cursor: allSeen ? 'pointer' : 'default',
              opacity: allSeen ? 1 : 0.35,
              transition: 'all 500ms ease',
              padding: '10px 18px', whiteSpace: 'nowrap',
            }}
          >
            what&apos;s next →
          </button>
          {!allSeen && (
            <p style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.05em', color: 'var(--ink-4)', margin: '8px 0 0', textAlign: 'center' }}>
              tap all {allOthers.length} to unlock
            </p>
          )}
        </div>
      </div>

      {/* Hint or detail */}
      {!activeEntry ? (
        <p style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--ink-4)', textAlign: 'center' }}>
          tap any dimension to explore it
        </p>
      ) : (
        <div style={{ width: '100%' }}>
          <DetailPanel entry={activeEntry} maxWidth={720} />
        </div>
      )}

    </div>
  )
}

// ── Page 2: What's next ───────────────────────────────────────────────────────

function WhatsNextPage({ data }: { data: RevealData }) {
  const router  = useRouter()
  const letters = data.tasteCode.entries.map(e => e.letter).join('')

  const actions = [
    { label: 'connect with friends',     sub: "see what they're watching · swap recs · compare your tastes", href: '/friends' },
    { label: 'explore recommendations',  sub: 'films matched to your taste code',                            href: '/recommended' },
    { label: "log what you've watched",  sub: 'rate it, write notes, reflect on it',                        href: '/add' },
    { label: "log what you're watching", sub: "mid-reel — we'll follow up when you finish",                  href: '/add' },
    { label: 'add to your watch list',   sub: 'save something you want to see',                             href: '/watch-list/save' },
  ]

  return (
    <div style={{ padding: '56px 7% 80px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 20 }}>
        ★ YOUR TASTE CODE
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
        {data.tasteCode.entries.map(e => (
          <div key={e.letter} style={{
            width: 72, height: 88,
            display: 'inline-flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            border: '0.5px solid var(--paper-edge)', borderRadius: 12,
            background: 'var(--bone)',
          }}>
            <span style={{ fontFamily: 'var(--serif-display)', fontSize: 38, fontWeight: 500, color: 'var(--ink)' }}>{e.letter}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{e.label}</span>
          </div>
        ))}
      </div>

      <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 30, fontWeight: 400, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.2, textAlign: 'center' }}>
        {letters} — and it&apos;s yours.
      </h1>
      <p style={{ fontFamily: 'var(--serif-body)', fontSize: 14, fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.7, margin: '0 0 44px', maxWidth: 380, textAlign: 'center' }}>
        your taste code sharpens as you log more. here&apos;s where to take it.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 420 }}>
        {actions.map((a, i) => (
          <button
            key={i}
            onClick={() => router.push(a.href)}
            style={{
              textAlign: 'center', padding: '12px 16px',
              border: '0.5px solid var(--paper-edge)', borderRadius: 10,
              background: 'var(--paper)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              transition: 'background 120ms',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bone)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper)' }}
          >
            <span style={{ fontFamily: 'var(--serif-display)', fontSize: 14.5, fontWeight: 500, color: 'var(--ink)' }}>{a.label}</span>
            <span style={{ fontFamily: 'var(--serif-body)', fontSize: 12, fontStyle: 'italic', color: 'var(--ink-4)' }}>{a.sub}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <button
          onClick={() => router.push('/profile')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: 3, padding: 0 }}
        >
          view my profile →
        </button>
      </div>
    </div>
  )
}

// ── Waiting screen ────────────────────────────────────────────────────────────

function LetterSlots({ letters, filmCount }: {
  letters: Array<{ letter: string; locked: boolean }>
  filmCount: number
}) {
  const slots = [0, 1, 2, 3].map(i => letters[i] ?? null)
  return (
    <div style={{ margin: '32px 0 20px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        {slots.map((slot, i) => (
          <div key={i} style={{
            width: 68, height: 84,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: slot?.locked ? '1.5px solid var(--s-ink)' : slot ? '1px solid var(--paper-edge)' : '1px dashed var(--paper-edge)',
            borderRadius: 10,
            background: slot?.locked ? 'var(--s-tint)' : slot ? 'var(--bone)' : 'transparent',
            transition: 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            fontFamily: 'var(--serif-display)', fontWeight: 500,
            fontSize: slot ? 40 : 28,
            color: slot?.locked ? 'var(--s-ink)' : slot ? 'var(--ink)' : 'var(--paper-edge)',
          }}>
            {slot ? slot.letter : '?'}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
        {filmCount > 0 ? `${filmCount} FILMS MAPPED` : 'READING YOUR HISTORY…'}
      </div>
    </div>
  )
}

function WaitingScreen({ phase, letters, filmCount }: {
  phase: 'loading' | 'notReady'
  letters: Array<{ letter: string; locked: boolean }>
  filmCount: number
}) {
  const lockedCount = letters.filter(l => l.locked).length
  const statusLabel = lockedCount >= 4 ? 'ALMOST READY…' : 'STILL BUILDING…'
  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 7%', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', marginBottom: 16 }}>★ YOUR TASTE CODE</div>
        <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 44, fontWeight: 400, color: 'var(--ink)', lineHeight: 1.05, margin: '0 0 14px' }}>computing your taste code.</h1>
        <p style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>we&apos;re analysing your ratings across 12 cinematic dimensions.</p>
        <LetterSlots letters={letters} filmCount={filmCount} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-3)', display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{statusLabel}</span>
        </div>
        <div style={{ marginTop: 48 }}>
          <button onClick={() => window.location.reload()} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>try again</button>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
    </AppShell>
  )
}

function ErrorScreen({ message }: { message: string }) {
  const router = useRouter()
  return (
    <AppShell withAdd={false}>
      <div style={{ padding: '56px 7%', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.12em', marginBottom: 16 }}>★ YOUR TASTE CODE</div>
        <h1 style={{ fontFamily: 'var(--serif-display)', fontSize: 32, fontWeight: 400, color: 'var(--ink)', margin: '0 0 14px' }}>something went wrong.</h1>
        <p style={{ fontFamily: 'var(--serif-body)', fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 32px' }}>{message}</p>
        <button onClick={() => router.push('/profile')} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>go to profile</button>
      </div>
    </AppShell>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function RevealPage() {
  const params    = useParams()
  const sessionId = params.id as string

  const [data,     setData]     = useState<RevealData | null>(null)
  const [phase,    setPhase]    = useState<'loading' | 'notReady' | 'reveal' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [page,     setPage]     = useState(0)

  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const [seenLetters,    setSeenLetters]    = useState<Set<string>>(new Set())

  const [previewLetters,   setPreviewLetters]   = useState<Array<{ letter: string; locked: boolean }>>([])
  const [previewFilmCount, setPreviewFilmCount] = useState(0)

  const revealIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolvedRef        = useRef(false)

  const handleSelectLetter = useCallback((letter: string) => {
    setSelectedLetter(letter)
    setSeenLetters(prev => new Set([...prev, letter]))
  }, [])

  const handleBackFromPage1 = useCallback((letter: string) => {
    setSelectedLetter(letter)
    setSeenLetters(prev => new Set([...prev, letter]))
    setPage(0)
  }, [])

  const fetchPreview = useCallback(() => {
    fetch('/api/import/taste-preview')
      .then(r => r.ok ? r.json() : null)
      .then((json: TastePreview | null) => {
        if (!json) return
        setPreviewLetters((json.allLetters ?? []).map(l => ({ letter: l.letter, locked: l.gap >= 35 })))
        setPreviewFilmCount(json.filmCount ?? 0)
      })
      .catch(() => {})
  }, [])

  const attemptReveal = useCallback(() => {
    fetch(`/api/onboarding/session/${sessionId}/reveal`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(json => {
        if (resolvedRef.current) return
        if (json.tasteCode) {
          resolvedRef.current = true
          if (revealIntervalRef.current)  clearInterval(revealIntervalRef.current)
          if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
          setData(json)
          setPhase('reveal')
        } else {
          setPhase(prev => prev === 'loading' ? 'notReady' : prev)
        }
      })
      .catch(() => {
        if (resolvedRef.current) return
        setPhase(prev => {
          if (prev === 'loading') { setErrorMsg('Could not load your taste code. Please try again.'); return 'error' }
          return prev
        })
      })
  }, [sessionId])

  useEffect(() => {
    fetchPreview()
    attemptReveal()
    previewIntervalRef.current = setInterval(fetchPreview, 3000)
    revealIntervalRef.current  = setInterval(attemptReveal, 6000)
    return () => {
      if (revealIntervalRef.current)  clearInterval(revealIntervalRef.current)
      if (previewIntervalRef.current) clearInterval(previewIntervalRef.current)
    }
  }, [fetchPreview, attemptReveal])

  if (phase === 'loading' || phase === 'notReady') {
    return <WaitingScreen phase={phase} letters={previewLetters} filmCount={previewFilmCount} />
  }
  if (phase === 'error') return <ErrorScreen message={errorMsg} />
  if (!data) return null

  return (
    <AppShell withAdd={false}>
      {page === 0 && (
        <LetterMomentPage
          data={data}
          onNext={() => setPage(1)}
          selectedLetter={selectedLetter}
          seenLetters={seenLetters}
          onSelectLetter={handleSelectLetter}
        />
      )}
      {page === 1 && (
        <BreakdownPage
          data={data}
          onBack={handleBackFromPage1}
          onNext={() => setPage(2)}
        />
      )}
      {page === 2 && <WhatsNextPage data={data} />}
    </AppShell>
  )
}
