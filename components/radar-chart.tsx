'use client'
import { TasteDimensions } from '@/lib/prompts/taste-profile'

export const AXES: { key: keyof TasteDimensions; label: string; neg: string; pos: string }[] = [
  { key: 'pace',         label: 'PACE',       neg: 'patient',     pos: 'kinetic'     },
  { key: 'style',        label: 'STYLE',      neg: 'restrained',  pos: 'expressive'  },
  { key: 'complexity',   label: 'COMPLEXITY', neg: 'accessible',  pos: 'complex'     },
  { key: 'warmth',       label: 'WARMTH',     neg: 'cold',        pos: 'warm'        },
  { key: 'tone',         label: 'TONE',       neg: 'light',       pos: 'dark'        },
  { key: 'story_engine', label: 'STORY',      neg: 'character',   pos: 'plot-driven' },
]

export const AXIS_INFO: Record<keyof TasteDimensions, {
  title: string
  neg: string
  pos: string
  describe: (v: number, name?: string) => string
}> = {
  pace: {
    title: 'Pace',
    neg: 'patient',
    pos: 'kinetic',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      const their = name === 'You' ? 'your' : `${name}'s`
      if (v > 0.6) return `${name} strongly gravitate toward slow-burn cinema — films that earn their revelations through duration. Tarkovsky's long takes, Chantal Akerman's fixed camera, early Kubrick letting a scene breathe until it means something. ${name === 'You' ? 'You\'re' : `${name} is`} comfortable sitting in atmosphere without needing forward momentum to stay engaged.`
      if (v > 0.25) return `${name} tend toward slower, more contemplative pacing — ${they} value films that take their time, but don't need to push all the way into slow cinema. Directors who let scenes develop without rushing to the next thing tend to land well.`
      if (v > -0.25) return `Pace doesn't strongly drive ${their} taste. ${name === 'You' ? 'You\'re' : `${name} is`} comfortable across the spectrum — from propulsive thrillers to deliberately unhurried character studies — as long as the pacing feels intentional for the film.`
      if (v > -0.6) return `${name} tend toward kinetic, propulsive filmmaking — ${they} want a film to move, to build, to keep things pressing forward. Slow cinema tends to test ${their} patience; ${they} engage more readily when the editing rhythm and story momentum stay active.`
      return `${name} strongly prefer fast-paced, kinetic cinema — urgency, momentum, and forward drive are core to what makes a film feel alive. Deliberately slow or durational filmmaking tends to read as indulgent rather than immersive.`
    },
  },
  style: {
    title: 'Visual Style',
    neg: 'restrained',
    pos: 'expressive',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      const their = name === 'You' ? 'your' : `${name}'s`
      if (v > 0.6) return `${name} are drawn to films where the visual language is doing as much work as the script. Cinematography, color grading, production design, editing rhythm — ${they} notice when these are treated as primary storytelling tools, not just packaging. Wong Kar-wai's saturated blur, Kubrick's unsettling symmetry, Almodóvar's charged color palettes. ${name === 'You' ? 'You respond to' : `${name} responds to`} directors who have a visual argument to make.`
      if (v > 0.25) return `${name} lean toward expressive, visually intentional filmmaking. ${they} notice when a director has a distinct visual voice — when cinematography, production design, or editing rhythm is clearly doing interpretive work, not just capturing action. The visual side of a film matters to ${their} overall reading of it.`
      if (v > -0.25) return `Visual style doesn't strongly tip ${their} preferences. ${name === 'You' ? 'You appreciate' : `${name} appreciates`} both stripped-back, observational filmmaking and highly stylized work — what matters is whether the visual choices feel appropriate to what the film is trying to do, not whether they announce themselves.`
      if (v > -0.6) return `${name} tend toward restrained, economical filmmaking — ${they} trust a story to land without visual commentary getting in the way. When cinematography or production design starts to feel self-conscious or decorative, it can pull ${they} out. The Dardennes, early Loach, Cassavetes-style naturalism tends to resonate more than stylized work.`
      return `${name} strongly prefer stripped-back cinema where the craft is invisible — camera, color, and design that serve the story without drawing attention to themselves. Highly stylized filmmaking can read as directors prioritizing aesthetics over honesty, and that tends to push ${name === 'You' ? 'you' : name} away.`
    },
  },
  complexity: {
    title: 'Complexity',
    neg: 'accessible',
    pos: 'complex',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      const their = name === 'You' ? 'your' : `${name}'s`
      if (v > 0.6) return `${name} are drawn to films that demand something — ambiguity, unresolved questions, layered subtext that doesn't explain itself. Open endings aren't frustrating; they're invitations. ${name === 'You' ? 'You tend to' : `${name} tends to`} return to films that reveal more on a second watch and are skeptical of work that ties everything up neatly.`
      if (v > 0.25) return `${name} lean toward films with depth and layers over crowd-pleasers that do all the interpretive work for ${they}. ${name === 'You' ? 'You don\'t need' : `${name} doesn't need`} a film to be opaque or difficult, but ${they} respond better when there's genuine subtext to engage with rather than just surface-level story.`
      if (v > -0.25) return `${name === 'You' ? 'You move' : `${name} moves`} comfortably between more demanding and more accessible films. Whether a film is emotionally direct or requires active interpretation doesn't strongly predict whether it lands — the execution matters more than the difficulty level.`
      if (v > -0.6) return `${name} tend toward clear, direct storytelling — ${they} engage most when a film's emotional logic and narrative intent are legible without requiring decoding. Films that withhold too much or stay deliberately obscure can feel like they're working harder than they need to.`
      return `${name} strongly prefer accessible, clearly told stories. ${name === 'You' ? 'You want to be' : `${name} wants to be`} transported, not tested — films that demand extensive interpretation or refuse to commit to meaning can feel self-indulgent. Emotional directness and narrative clarity are features, not weaknesses.`
    },
  },
  warmth: {
    title: 'Emotional Temperature',
    neg: 'cold',
    pos: 'warm',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      const their = name === 'You' ? 'your' : `${name}'s`
      if (v > 0.6) return `${name} respond strongly to emotional warmth in film — human connection, tenderness, and the feeling of being seen through characters. ${name === 'You' ? 'You want to care' : `${name} wants to care`} about someone on screen, and films that achieve genuine emotional intimacy tend to sit with ${they} longest.`
      if (v > 0.25) return `${name} lean toward emotionally warm, human-centered filmmaking — ${they} tend to connect with films that prioritize feeling over detachment. ${name === 'You' ? 'You don\'t need sentimentality' : `${name} doesn't need sentimentality`}, but emotional availability in a film helps ${they} invest.`
      if (v > -0.25) return `${name === 'You' ? 'You move' : `${name} moves`} between colder and warmer emotional registers without a strong pull in either direction. Whether a film is emotionally available or more clinical doesn't significantly predict how well it lands — ${they} respond to what the film earns, regardless of temperature.`
      if (v > -0.6) return `${name} tend toward cooler, more detached filmmaking — ${they} engage more readily with films that observe characters from a distance rather than asking ${they} to feel along with them. Emotional manipulation or excessive sentimentality tends to read as a weakness.`
      return `${name} are drawn to cold, clinical cinema — films that observe rather than embrace, that trust the audience to feel without being guided there. Emotional distance isn't alienating; it's honest. Films that push too hard for empathy or sentiment tend to lose ${name === 'You' ? 'you' : name}.`
    },
  },
  tone: {
    title: 'Tone',
    neg: 'light',
    pos: 'dark',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      if (v > 0.6) return `${name} gravitate strongly toward dark, bleak, and morally unresolved cinema. ${name === 'You' ? 'You\'re' : `${name} is`} drawn to films that don't offer easy comfort — tragedies that commit fully, stories that sit with moral complexity without resolving it, and work that takes suffering seriously rather than pivoting toward hope.`
      if (v > 0.25) return `${name} lean toward serious, heavy films over lighter fare. ${name === 'You' ? 'You can enjoy' : `${name} can enjoy`} a comedy, but ${they} tend to find work that operates at a darker register more resonant and more memorable.`
      if (v > -0.25) return `Tone isn't decisive for ${name === 'You' ? 'you' : name} — ${they} move between dark and light films without a strong preference. A well-executed comedy lands as well as a bleak drama. What matters is whether the tone serves the film's intent.`
      if (v > -0.6) return `${name} lean toward lighter, funnier, or more uplifting films over heavy dramas. ${name === 'You' ? 'You can handle' : `${name} can handle`} darkness when a film earns it, but ${they} don't seek it out — films that offer release, humor, or hope tend to resonate more.`
      return `${name} strongly prefer films that offer levity, humor, or uplift. Heavy, bleak, or unrelentingly dark cinema tends to feel punishing rather than illuminating — ${they} want a film that gives something back, not just works ${name === 'You' ? 'you' : name} over.`
    },
  },
  story_engine: {
    title: 'Story Engine',
    neg: 'character',
    pos: 'plot-driven',
    describe: (v, name = 'You') => {
      const they = name === 'You' ? 'you' : name
      const their = name === 'You' ? 'your' : `${name}'s`
      if (v > 0.6) return `${name} are driven by plot — structure, momentum, and the forward pull of what happens next. A well-engineered twist or escalation keeps ${they} locked in. ${name === 'You' ? 'You tend to be' : `${name} tends to be`} more impatient with films that prioritize interior psychology over narrative movement — the story should have somewhere to go.`
      if (v > 0.25) return `${name} lean toward plot-driven storytelling — ${they} engage readily when a film has strong narrative architecture, clear stakes, and momentum. Character work matters, but ${name === 'You' ? 'you\'re' : `${name} is`} more engaged when the plot gives ${their} investment somewhere to go.`
      if (v > -0.25) return `${name === 'You' ? 'You respond' : `${name} responds`} equally well to character-driven and plot-driven films. Whether a film is propelled by event or by the slow revelation of who someone is doesn't strongly predict ${their} engagement — both can work.`
      if (v > -0.6) return `${name} lean toward character study over plot mechanics — ${they} are more interested in who someone is than in what happens to them. When a film's events are clearly subordinate to its exploration of interior life, it tends to land better than work where plot drives everything.`
      return `${name} are drawn to pure character study — films that live inside a person's psychology, relationships, and contradictions without needing an engineered plot to justify the runtime. Narrative propulsion for its own sake can feel like a distraction from what ${they} actually care about.`
    },
  },
}

const N = AXES.length
const CX = 160
const CY = 155
const R = 100
const LABEL_R = 128

function angleFor(i: number) {
  return (i * (2 * Math.PI) / N) - Math.PI / 2
}

function pt(i: number, radius: number) {
  const a = angleFor(i)
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) }
}

function norm(v: number) {
  return Math.max(0, Math.min(1, (v + 1) / 2))
}

interface RadarChartProps {
  dimensions: TasteDimensions
  selectedDim?: keyof TasteDimensions | null
  onSelectDim?: (k: keyof TasteDimensions | null) => void
  accentColor?: string
}

export function RadarChart({
  dimensions,
  selectedDim = null,
  onSelectDim,
  accentColor = 'var(--s-ink)',
}: RadarChartProps) {
  const rings = [0.33, 0.66, 1].map(pct => {
    const pts = AXES.map((_, i) => pt(i, R * pct))
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'
  })

  const axisLines = AXES.map((_, i) => {
    const tip = pt(i, R)
    return `M ${CX} ${CY} L ${tip.x} ${tip.y}`
  })

  const profilePts = AXES.map((axis, i) => {
    const v = norm(dimensions[axis.key])
    return pt(i, R * v)
  })
  const profilePath = profilePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <svg
      width={320}
      height={310}
      viewBox="0 0 320 310"
      style={{ overflow: 'visible', display: 'block' }}
    >
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--paper-edge)" strokeWidth={0.75} />
      ))}
      {axisLines.map((d, i) => (
        <path key={i} d={d} stroke="var(--paper-edge)" strokeWidth={0.75} />
      ))}
      <path
        d={profilePath}
        fill={accentColor}
        fillOpacity={0.12}
        stroke={accentColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {profilePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={accentColor} />
      ))}

      {AXES.map((axis, i) => {
        const angle = angleFor(i)
        const lp = { x: CX + LABEL_R * Math.cos(angle), y: CY + LABEL_R * Math.sin(angle) }
        const anchor = lp.x < CX - 5 ? 'end' : lp.x > CX + 5 ? 'start' : 'middle'
        const dyOffset = lp.y < CY - 5 ? -6 : lp.y > CY + 5 ? 14 : 4
        const isSelected = selectedDim === axis.key

        return (
          <g
            key={axis.key}
            style={{ cursor: onSelectDim ? 'pointer' : 'default' }}
            onClick={() => onSelectDim?.(isSelected ? null : axis.key)}
          >
            {/* Invisible hit area */}
            <circle cx={lp.x} cy={lp.y} r={20} fill="transparent" />
            <text
              x={lp.x}
              y={lp.y + dyOffset}
              textAnchor={anchor}
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 9,
                fill: isSelected ? accentColor : 'var(--ink-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                transition: 'fill 120ms',
                fontWeight: isSelected ? 700 : 400,
                userSelect: 'none',
              }}
            >
              {axis.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
