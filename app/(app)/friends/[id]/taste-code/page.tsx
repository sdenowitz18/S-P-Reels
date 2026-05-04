'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { AppShell } from '@/components/app-shell'
import { TasteCode, TasteCodeEntry, TasteCodeFilm } from '@/lib/taste-code'
import { TasteLetter, poleBadgeTier } from '@/components/taste-letter'

function HmlBadge({ score }: { score: number }) {
  const tier = poleBadgeTier(score)
  return (
    <span style={{
      background: tier === 'H' ? 'var(--forest, #225533)' : tier === 'M' ? 'var(--sun, #d4a847)' : 'var(--paper-edge, #ccc)',
      color: tier === 'L' ? 'var(--ink-3)' : '#fff',
      borderRadius: 999, padding: '1px 5px',
      fontFamily: 'var(--mono)', fontSize: 7, fontWeight: 700, letterSpacing: '0.02em',
      lineHeight: 1.6,
    }}>{tier}</span>
  )
}

// Signal strength thresholds — gap-based, not rank-based
const STRONG_GAP   = 35
const MODERATE_GAP = 15

function signalTierFor(gap: number): 'strong' | 'moderate' | 'weak' {
  return gap >= STRONG_GAP ? 'strong' : gap >= MODERATE_GAP ? 'moderate' : 'weak'
}

const DIM_SPECTRUM_PROSE: Record<string, string> = {
  narrative_legibility:     "This axis runs from films that orient you fully — clear story logic, knowable cause and effect — to films that deliberately fragment, withhold, or obscure. Legible films ask you to follow; opaque films ask you to construct meaning yourself.",
  emotional_directness:     "Some films put their emotional stakes right on the surface — feeling is declared, not hidden. Others internalize emotion entirely, trusting the viewer to supply it. This axis separates the felt from the inferred.",
  plot_vs_character:        "Plot-driven films are animated by events — what happens next is the central question. Character-driven films are animated by a person — who they are and why is what matters. Most films mix both; this axis measures which dominates.",
  naturalistic_vs_stylized: "Naturalistic films hide their own craft — the camera, performances, and world feel observed rather than constructed. Stylized films announce their artifice: lighting, performance, and composition are visibly shaped by a sensibility.",
  narrative_closure:        "Closure describes what a film does with its open questions. Films at one end resolve — arcs completed, tensions released. Films at the other open rather than close — meanings withheld, endings that linger unresolved.",
  intimate_vs_epic:         "This axis runs from films that inhabit one or two lives closely — small, interior, up close — to films that encompass history, systems, or forces larger than any individual. Intimate films go inward; epic films reach outward.",
  accessible_vs_demanding:  "Accessible films meet you where you are — no prior knowledge, no patience tax required. Demanding films ask something of you: slower pacing, unconventional structure, tolerance for ambiguity. This axis measures your threshold.",
  psychological_safety:     "Some films ultimately reassure — the world coheres, you leave intact. Others deliberately disturb or destabilize, leaving discomfort purposefully unresolved. This axis measures whether cinema works on you as shelter or as challenge.",
  moral_clarity:            "Films with moral clarity give you a legible ethical landscape — right and wrong are ultimately knowable, even when hard. Morally ambiguous films refuse to adjudicate: they present genuine ethical contest without verdict.",
  behavioral_realism:       "Realistic characters behave in recognizable, contradictory, human ways — psychologically plausible even at their worst. Archetypal characters operate as types or mythic constructs — larger than life, legible rather than complex.",
  sensory_vs_intellectual:  "Sensory filmmaking works through image, sound, and visceral experience — it moves you before you understand why. Intellectual filmmaking works through idea, argument, and structure — it engages the mind before the body.",
  kinetic_vs_patient:       "Kinetic films are dense with event — rapid cutting, momentum, a film that carries you forward. Patient films breathe — slow unfolding, stillness, inhabiting time rather than racing through it.",
}

function midSlice(films: TasteCodeFilm[]): TasteCodeFilm[] {
  const mid = Math.floor(films.length / 2)
  return films.slice(Math.max(0, mid - 1), mid + 2)
}

function PoleFilmStrip({ films, color, align }: {
  films: TasteCodeFilm[]; color: string; align: 'left' | 'right'
}) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {films.slice(0, 3).map(f => (
        <div key={f.film_id} style={{ width: 52, textAlign: 'center' }}>
          <div style={{ width: 52, height: 78, borderRadius: 3, overflow: 'hidden', background: 'var(--paper-edge)', position: 'relative', marginBottom: 4 }}>
            {f.poster_path
              ? <Image src={f.poster_path} alt={f.title} fill style={{ objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3, fontSize: 6, fontFamily: 'var(--mono)', color: 'var(--ink-4)', textAlign: 'center' }}>
                  {f.title.toUpperCase()}
                </div>
            }
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color, letterSpacing: '0.02em' }}>
            {f.stars.toFixed(1)}★
          </div>
        </div>
      ))}
    </div>
  )
}

function DimRow({ entry, rank, accentColor }: {
  entry: TasteCodeEntry; rank: number; accentColor: string
}) {
  const signalTier = signalTierFor(entry.gap)

  const domAvg = entry.sampleFilms.length > 0
    ? entry.sampleFilms.reduce((s, f) => s + f.stars, 0) / entry.sampleFilms.length : null
  const oppAvg = entry.oppSampleFilms.length > 0
    ? entry.oppSampleFilms.reduce((s, f) => s + f.stars, 0) / entry.oppSampleFilms.length : null

  const domFilmsDisplay = signalTier === 'weak'
    ? midSlice(entry.sampleFilms)
    : entry.sampleFilms.slice(0, 3)
  const oppFilmsDisplay = signalTier === 'weak'
    ? midSlice(entry.oppSampleFilms)
    : [...entry.oppSampleFilms].sort((a, b) => a.stars - b.stars).slice(0, 3)

  // Prose: tier-aware, personalised (friend-facing) — every tier explains the poles
  const prose = signalTier === 'strong'
    ? `${entry.description} ${entry.oppNegativeDescription}`
    : signalTier === 'moderate'
    ? `${entry.description} Their ratings pull this direction, though it isn't a defining preference.`
    : `Their ratings don't clearly separate ${entry.label} from ${entry.oppLabel}. ${DIM_SPECTRUM_PROSE[entry.dimKey] ?? ''}`

  const tierBg = signalTier === 'strong' ? 'rgba(74, 107, 62, 0.04)' : signalTier === 'moderate' ? 'rgba(190, 150, 60, 0.035)' : 'rgba(160, 80, 60, 0.04)'
  const tierBorderColor = signalTier === 'strong' ? 'rgba(74, 107, 62, 0.4)' : signalTier === 'moderate' ? 'rgba(190, 150, 60, 0.45)' : 'rgba(160, 80, 60, 0.4)'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr 200px 1fr', gap: 24, alignItems: 'flex-start',
      padding: '28px 16px 28px 20px', borderBottom: '0.5px solid var(--paper-edge)',
      borderLeft: `3px solid ${tierBorderColor}`, background: tierBg, margin: '0 -16px',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)', paddingTop: 4, textAlign: 'right' }}>{rank}</div>

      {/* Dominant pole */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' }}>{entry.letter}</span>
          <span style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, color: accentColor }}>{entry.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 100, height: 3, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${entry.poleScore}%`, height: '100%', background: accentColor, borderRadius: 999 }} />
          </div>
          <HmlBadge score={entry.poleScore} />
        </div>
        <PoleFilmStrip films={domFilmsDisplay} color={accentColor} align="left" />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 8 }}>
          {domAvg != null ? `${domAvg.toFixed(2)}★` : '—'} avg · {entry.filmCount} films
        </div>
      </div>

      {/* Prose */}
      <div>
        {signalTier !== 'strong' && (
          <div style={{ fontFamily: 'var(--mono)', fontSize: 7, letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 8 }}>
            {signalTier === 'moderate' ? 'MODERATE SIGNAL' : 'NO CLEAR PREFERENCE'}
          </div>
        )}
        <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)', opacity: signalTier === 'strong' ? 1 : signalTier === 'moderate' ? 0.82 : 0.6, margin: 0 }}>
          {prose}
        </p>
      </div>

      {/* Opposite pole */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, justifyContent: 'flex-end' }}>
          <span style={{ fontFamily: 'var(--serif-display)', fontSize: 15, fontWeight: 500, color: 'var(--ink-4)' }}>{entry.oppLabel}</span>
          <span style={{ fontFamily: 'var(--serif-display)', fontSize: 36, fontWeight: 600, lineHeight: 1, color: 'var(--ink-3)' }}>{entry.oppLetter}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'flex-end' }}>
          <HmlBadge score={entry.oppositeScore} />
          <div style={{ width: 100, height: 3, background: 'var(--paper-edge)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${entry.oppositeScore}%`, height: '100%', background: 'var(--ink-4)', borderRadius: 999 }} />
          </div>
        </div>
        <PoleFilmStrip films={oppFilmsDisplay} color="var(--ink-4)" align="right" />
        <div style={{ fontFamily: 'var(--mono)', fontSize: 7, color: 'var(--ink-4)', letterSpacing: '0.06em', marginTop: 8 }}>
          {entry.oppFilmCount} films · {oppAvg != null ? `${oppAvg.toFixed(2)}★` : '—'} avg
        </div>
      </div>
    </div>
  )
}

export default function FriendTasteCodePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [friendId, setFriendId] = useState('')
  const [friendName, setFriendName] = useState('')
  const [tasteCode, setTasteCode] = useState<TasteCode | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(async ({ id }) => {
      setFriendId(id)
      const data = await fetch(`/api/friends/${id}/taste`).then(r => r.json())
      setFriendName(data?.friendName ?? '')
      setTasteCode(data?.tasteCode ?? null)
      setLoading(false)
    })
  }, [params])

  const firstName = friendName.split(' ')[0]

  return (
    <AppShell active="friends">
      <div style={{ padding: '40px 64px 100px', maxWidth: 1060, margin: '0 auto' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)', padding: 0, marginBottom: 36 }}
        >
          ← back
        </button>

        <div style={{ marginBottom: 48 }}>
          <div className="t-meta" style={{ fontSize: 10, color: 'var(--ink-3)', marginBottom: 10 }}>★ FULL TASTE CODE</div>
          <h1 className="t-display" style={{ fontSize: 46, margin: 0, lineHeight: 1 }}>
            {firstName
              ? <>{firstName}'s <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>dimensions</span>.</>
              : <>their <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--p-ink)' }}>dimensions</span>.</>
            }
          </h1>
          <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-4)', marginTop: 12, lineHeight: 1.6 }}>
            all 12 cinematic dimensions, ranked by signal strength.
          </p>
        </div>

        {loading && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>loading…</p>
        )}

        {!loading && !tasteCode && (
          <p style={{ fontStyle: 'italic', fontSize: 14, color: 'var(--ink-3)', fontFamily: 'var(--serif-italic)' }}>
            {firstName || 'they'} hasn't rated enough films to generate a taste code yet.
          </p>
        )}

        {!loading && tasteCode && (
          <div>
            {/* Identity code badge */}
            <div style={{
              display: 'inline-flex', gap: 8, alignItems: 'center',
              padding: '10px 16px', background: 'var(--paper-2)',
              border: '0.5px solid var(--paper-edge)', borderRadius: 10,
              marginBottom: 48,
            }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>
                {firstName ? `${firstName.toUpperCase()}'S CODE` : 'THEIR CODE'}
              </span>
              {tasteCode.entries.map(e => (
                <TasteLetter key={e.letter} letter={e.letter} poleScore={e.poleScore} size="md" />
              ))}
            </div>

            {/* Signal legend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 48 }}>
              {([
                {
                  border: 'rgba(74, 107, 62, 0.4)',
                  bg:     'rgba(74, 107, 62, 0.04)',
                  label:  'STRONG SIGNAL',
                  prose:  'Their ratings pull clearly toward one end — a genuine, recurring preference across their library.',
                },
                {
                  border: 'rgba(190, 150, 60, 0.45)',
                  bg:     'rgba(190, 150, 60, 0.035)',
                  label:  'MODERATE SIGNAL',
                  prose:  'A real lean shows up in their ratings, but not consistently enough to be a defining trait.',
                },
                {
                  border: 'rgba(160, 80, 60, 0.4)',
                  bg:     'rgba(160, 80, 60, 0.04)',
                  label:  'NO CLEAR PREFERENCE',
                  prose:  'Their ratings don\'t separate these films — they respond to both poles about equally.',
                },
              ] as const).map(({ border, bg, label, prose }) => (
                <div key={label} style={{
                  borderLeft: `3px solid ${border}`,
                  background: bg,
                  padding: '16px 20px',
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
                    {label}
                  </div>
                  <p style={{ fontFamily: 'var(--serif-italic)', fontStyle: 'italic', fontSize: 12, lineHeight: 1.6, color: 'var(--ink-4)', margin: 0 }}>
                    {prose}
                  </p>
                </div>
              ))}
            </div>

            {/* All 12 dimensions */}
            {(tasteCode.allEntries ?? tasteCode.entries).map((entry, i) => (
              <DimRow
                key={entry.dimKey}
                entry={entry}
                rank={i + 1}
                accentColor="var(--p-ink)"
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
