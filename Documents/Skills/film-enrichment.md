# FILM_ENRICHMENT_SKILL.md
## Skill: Enrich Any Film Entering the System

---

### PURPOSE

Every film that enters the system — whether through a Letterboxd import, a manual log, a watchlist add, or a cold-start recognition exercise — must be fully enriched before it can be used in taste profiles, contradiction mapping, or interview discussions.

Enrichment is a three-phase pipeline that runs once per film. Because scores are **film-side attributes only** (they describe the film, not the viewer), they are stored in the shared `films` table and reused for every user who has seen that film. **Never re-enrich a film that is already fully enriched.** Check for existing `dimensions_v2` and `ai_brief` before running.

---

### WHEN TO TRIGGER

Run film enrichment when:
- A user imports a Letterboxd CSV and a film in the import is not yet in the `films` table, OR has `dimensions_v2` as null
- A user manually logs a film as Watched and it is not yet enriched
- A user adds a film to their Watchlist and it is not yet enriched
- A film is included in the cold-start calibration set and is not yet enriched

**Delta rule:** Only enrich the films not already present and fully scored. Do not re-run on films that have both `ai_brief` and `dimensions_v2` populated.

---

### PHASE 1 — DATA COLLECTION

Retrieve all available factual data about the film from external sources. This happens before any AI analysis. All three sources run in parallel.

**Source 1: TMDb**
Fetch and store:
- Title, year, director
- Poster path, backdrop path
- Synopsis (overview)
- Runtime in minutes
- Cast (top-billed, stored as JSON with name and role)
- TMDB genre labels (stored raw — not used as taste signals, only as context)
- Keywords

**Source 2: Wikipedia**
Fetch critical reception text from the film's Wikipedia article. Look for: critical consensus, awards, notable reviews, cultural impact, legacy. Store as enrichment context for the AI brief generation in Phase 2. Non-fatal if unavailable.

**Source 3: Reddit**
Fetch viewer discourse from relevant subreddits (r/movies, r/TrueFilm, film-specific threads). Look for: what audiences responded to positively, what they found challenging or divisive, ongoing debates about the film. Store as enrichment context for Phase 2. Non-fatal if unavailable.

---

### PHASE 2 — AI BRIEF GENERATION

Using the data collected in Phase 1 as source material, generate a structured film brief. This is AI-generated and should prioritize real critical reception and viewer discourse from Phase 1 over training knowledge where available.

**Output fields:**

`emotional_question` — The central human tension this film explores. Not the plot summary — the underlying question about life, relationships, or society it is asking. One sentence.

`tone` — The tonal register of the film in 3–6 words. Examples: "melancholic but hopeful", "darkly comedic throughout", "bleak and unrelenting".

`genres` — 1–3 nuanced subgenre labels. Not broad TMDb categories like "Drama" in isolation. Use compound or qualified labels that capture the actual viewing experience: "psychological horror", "slow-burn sci-fi", "domestic noir", "coming-of-age drama", "neo-noir crime", "arthouse horror", "political satire", etc. These aggregate across a user's library to show their taste profile — make them specific enough to be meaningful.

`themes` — 2–4 themes, each with a name (2–3 words) and a 1–2 sentence summary of how that theme manifests specifically in this film.

`discourse` — Three fields:
- `loved`: what audiences and critics responded to positively (1–2 sentences)
- `wrestled_with`: what audiences found challenging, divisive, or hard to sit with (1–2 sentences)
- `debate`: the one ongoing question people argue about when discussing this film (1 sentence)

`scenes` — 3–5 of the most discussable moments, each named specifically (not "a key scene") with a one-sentence hook explaining why it is the most discussable — what it reveals, subverts, or makes the viewer feel.

`craft` — 2–4 specific filmmaking choices that define this film. Name the technique and describe its effect. No generic praise ("beautiful cinematography"). Examples: "Chivo Iñárritu's long takes in Birdman create the illusion of one continuous shot, collapsing the boundary between theatrical performance and cinematic reality."

`performances` — Only genuinely notable performances. 1–4 max. For each: actor name and what is specifically notable about this performance and why it matters to the film.

`viewer_fit` — Two fields:
- `connects`: what kind of viewer tends to connect strongly — specific about sensibility, not demographics
- `bounces`: what kind of viewer tends to bounce off it — specific about what they find frustrating

**Rules for brief generation:**
- Be specific to this film — no observations that could apply to any film in the genre
- If Wikipedia or Reddit data is available, use it as primary source; prefer real reception over training assumptions
- All text lowercase except proper nouns
- If knowledge of the film is limited, be conservative and rely on the synopsis

---

### PHASE 3 — DIMENSION SCORING

Score the film on all 12 cinematic dimensions. These scores are the primary input for contradiction mapping, taste code computation, and interview question generation.

Each dimension is a **bipolar spectrum** scored **0–100**, where:
- **0–15** = strong lean toward the LEFT pole
- **16–35** = moderate lean toward the LEFT pole
- **36–64** = genuinely in the middle (holds both qualities, or neither strongly)
- **65–84** = moderate lean toward the RIGHT pole
- **85–100** = strong lean toward the RIGHT pole

Score based on the film's **dominant viewer experience** — not edge cases or individual scenes. **Do not default to the middle to avoid commitment.** A score of 36–64 should only be used when a film genuinely holds both poles in tension or authentically sits between them.

Always include the pole label alongside every score so it is readable without reference to the definition.
Format: `72 (leans Ambiguous)` · `8 (leans Legible)` · `48 (middle)`

---

#### THE 12 DIMENSIONS

---

**1. NARRATIVE LEGIBILITY ←→ NARRATIVE OPACITY**

**Left (0) — Legible:** The film clearly signals what is happening, why characters do what they do, and what the story means. Cause and effect are transparent. The viewer is oriented at all times.

**Right (100) — Opaque:** The film withholds, fragments, or deliberately obscures meaning. Plot logic may be non-linear, dreamlike, or unexplained. The viewer must construct meaning rather than receive it.

*Legible (0–20):* Jurassic Park (5), The Dark Knight (8), The Shawshank Redemption (5), Parasite (22)
*Middle (36–64):* Eternal Sunshine of the Spotless Mind (45), Hereditary (42)
*Opaque (65–100):* The Tree of Life (75), Syndromes and a Century (82), Last Year at Marienbad (95), Inland Empire (98)

---

**2. EMOTIONAL DIRECTNESS ←→ EMOTIONAL RESTRAINT**

**CRITICAL DISTINCTION:** This dimension measures emotional *signaling* — how much the film guides the viewer's response — not emotional *intensity*. A film can be viscerally intense without being emotionally direct. Whiplash is overwhelming in intensity but deliberately withholds instruction on how to feel. It scores toward restraint.

**Left (0) — Direct:** The film actively guides the viewer's emotional response. Score swells at emotional moments. Performances are expressive and legible. The film does not trust the viewer to arrive at feeling without assistance.

**Right (100) — Restrained:** The film withholds emotional signaling. Performances are internalized. Score is minimal or absent. The camera does not editorialize. The viewer must do emotional work themselves.

*Direct (0–20):* The Pursuit of Happyness (3), Forrest Gump (5), Titanic (8), Schindler's List (18)
*Middle (36–64):* Whiplash (38), The Godfather (42)
*Restrained (65–100):* Wendy and Lucy (85), Aftersun (85), A Man Escaped (90), Jeanne Dielman (98)

---

**3. PLOT-DRIVEN ←→ CHARACTER-DRIVEN**

**Left (0) — Plot-Driven:** Momentum is generated by events, external forces, and action. Characters exist primarily to serve the story's forward movement. What happens next is the central question.

**Right (100) — Character-Driven:** Momentum is generated by internal psychological pressure, human texture, and relationship dynamics. Plot events are secondary to the interior lives being portrayed.

*Plot-Driven (0–20):* Die Hard (3), Mission: Impossible (8), Mad Max: Fury Road (5), The Fugitive (10)
*Middle (36–64):* No Country for Old Men (45), Hereditary (42)
*Character-Driven (65–100):* Boyhood (88), Marriage Story (92), A Woman Under the Influence (95), Jeanne Dielman (98)

---

**4. NATURALISTIC ←→ STYLIZED**

**Left (0) — Naturalistic:** The film presents itself as observed reality. Cinematography, production design, and performance conventions prioritize believability. The artifice of filmmaking is intentionally hidden.

**Right (100) — Stylized:** The film announces its own construction. Visual choices, performance modes, or production design are heightened, artificial, or self-conscious in ways that draw attention to the film as a made object.

*Naturalistic (0–20):* Bicycle Thieves (3), Wendy and Lucy (8), Secrets & Lies (10), The Florida Project (5)
*Middle (36–64):* Moonlight (40), Her (50), Hereditary (55)
*Stylized (65–100):* The Grand Budapest Hotel (92), Beau Is Afraid (95), Suspiria / Guadagnino (88)

---

**5. NARRATIVE CLOSURE ←→ DELIBERATE AMBIGUITY**

**Left (0) — Closure:** The film resolves its central tensions. Questions are answered. Emotional arcs complete. The viewer leaves with a clear sense of what happened and what it meant.

**Right (100) — Ambiguous:** The film deliberately refuses resolution. The ending opens rather than closes. Meaning is contested, withheld, or left for the viewer to construct. This is a choice, not a failure.

**Note:** Distinguish between *plot closure* and *emotional/meaning closure* — a film can resolve its plot while deliberately leaving its meaning open. Flag this in Notable Tensions when it applies.

*Closure (0–20):* Rocky (3), The Shawshank Redemption (5), Jurassic Park (5), most Marvel films (5–10)
*Middle (36–64):* Portrait of a Lady on Fire (58), The Godfather Part II (45)
*Ambiguous (65–100):* The Souvenir (85), Certified Copy (88), No Country for Old Men (90), Caché (95), Blow-Up (92)

---

**6. INTIMATE SCALE ←→ EPIC SCALE**

**Left (0) — Intimate:** The film is concerned with one or very few interior lives. World-building is minimal. History and society exist as backdrop at most. The emotional universe is small and close.

**Right (100) — Epic:** The film encompasses history, systems, societies, or forces larger than individuals. Individual characters exist as nodes in a larger design. Scope is the point.

*Intimate (0–20):* Aftersun (3), Portrait of a Lady on Fire (8), 45 Years (8), Kramer vs. Kramer (15)
*Middle (36–64):* Parasite (50), No Country for Old Men (48)
*Epic (65–100):* Gone with the Wind (88), Oppenheimer (85), 2001: A Space Odyssey (90), Lawrence of Arabia (95)

---

**7. ACCESSIBLE ←→ DEMANDING**

**Left (0) — Accessible:** The film meets the viewer where they are. No special prior knowledge, patience for unconventional pacing, or tolerance for formal experimentation required.

**Right (100) — Demanding:** The film requires significant effort, patience, prior context, or tolerance for formal experimentation. It does not accommodate the viewer — it asks the viewer to come to it.

**Critical:** This dimension measures the **demand placed on the audience** — not the film's popularity, commercial intent, or prestige. A widely loved film can still be demanding (2001: A Space Odyssey). An obscure film can still be accessible. Do not conflate popularity with this score.

*Accessible (0–20):* The Avengers (3), Jurassic Park (5), Top Gun: Maverick (5), The Shawshank Redemption (12)
*Middle (36–64):* Parasite (40), Fargo (38), No Country for Old Men (55)
*Demanding (65–100):* 2001: A Space Odyssey (78), Syndromes and a Century (85), Jeanne Dielman (95), Wavelength (99)

---

**8. PSYCHOLOGICAL SAFETY ←→ PSYCHOLOGICAL PROVOCATION**

**Left (0) — Safe:** The film ultimately reassures the viewer. Good and evil are distinguishable. The world, however harsh, makes sense. The viewer leaves feeling oriented and intact.

**Right (100) — Provocative:** The film leaves the viewer disturbed, destabilized, or genuinely challenged about human nature, social reality, or their own assumptions. The discomfort is intentional and unresolved.

*Safe (0–20):* Most Marvel films (5), The Blind Side (3), most mainstream biopics (10–20)
*Middle (36–64):* Hereditary (58), Boyhood (28)
*Provocative (65–100):* Caché (85), The Act of Killing (90), Dogtooth (95), Funny Games (98)

---

**9. MORAL CLARITY ←→ MORAL AMBIGUITY**

**Left (0) — Clear:** The film presents a legible ethical landscape. Heroes and villains are distinguishable. Right and wrong, while perhaps difficult, are ultimately knowable within the film's world.

**Right (100) — Ambiguous:** The film refuses to adjudicate morally. Characters exist in genuinely contested ethical territory. The film does not tell you who to root for or what to conclude.

*Clear (0–20):* Star Wars (2), Rocky (3), Schindler's List (10), most superhero films (5–12)
*Middle (36–64):* The Godfather (50), Whiplash (62)
*Ambiguous (65–100):* Chinatown (85), No Country for Old Men (90), Certified Copy (80), The Act of Killing (95)

---

**10. BEHAVIORAL REALISM ←→ ARCHETYPAL CHARACTERS**

**Left (0) — Realistic:** Characters behave in psychologically recognizable, messy, contradictory, human ways. Motivation is ambiguous. People surprise you the way real people do.

**Right (100) — Archetypal:** Characters function as types, symbols, or narrative constructs. Their behavior is coherent within genre or mythic logic but not within psychological realism. They exist to serve the story or an idea.

*Realistic (0–20):* Secrets & Lies (3), A Woman Under the Influence (8), Marriage Story (5), films of Mike Leigh generally (5–15)
*Middle (36–64):* The Godfather (45), No Country for Old Men (48 — split: Bell and Moss are realistic; Chigurh is explicitly archetypal by design)
*Archetypal (65–100):* The Dark Knight (75), Star Wars (95), most superhero and fairy-tale structures (80–98)

---

**11. SENSORY IMMERSION ←→ INTELLECTUAL ENGAGEMENT**

**Left (0) — Sensory:** The film primarily works through physical and emotional sensation. Sound design, image, rhythm, and atmosphere are the primary vehicles of meaning. You feel it before you think it.

**Right (100) — Intellectual:** The film primarily engages you as a puzzle, argument, essay, or idea. Meaning is constructed through reasoning, reference, and conceptual thinking. You think it before you feel it.

**Note:** Distinguish between films that *hold both poles by design* versus films that are simply *neither strongly*. 2001: A Space Odyssey holds both — the Stargate sequence is pure sensation inside a fundamentally intellectual argument. Eternal Sunshine sits in the middle differently: it is neither particularly sensory nor particularly intellectual. Flag the distinction in Notable Tensions.

*Sensory (0–20):* Enter the Void (5), Dunkirk (8), Apocalypse Now (10)
*Middle (36–64):* 2001: A Space Odyssey (38 — holds both by design), Eternal Sunshine of the Spotless Mind (45 — genuinely neither)
*Intellectual (65–100):* Sans Soleil (88), My Dinner with Andre (90), essay films generally (80–95)

---

**12. KINETIC ←→ PATIENT**

**Left (0) — Kinetic:** The film moves fast. Editing is rapid, scenes are dense with event, and the viewer is carried forward by momentum. There is always something happening, escalating, or cutting away.

**Right (100) — Patient:** The film breathes. Scenes play out at their own rhythm, often longer than narrative efficiency requires. Silence, stillness, and duration are used deliberately. The viewer inhabits time rather than is swept through it.

**Critical distinctions:**
- Score based on dominant experiential rhythm, not genre or reputation
- A film can be emotionally intense without being kinetic (Aftersun is slow; the intensity is interior)
- Do not conflate runtime with pace: a 3-hour action film can be kinetic; a 90-minute Rohmer film can be maximally patient

*Kinetic (0–20):* Mad Max: Fury Road (2), Speed (5), Die Hard (8), The Dark Knight (15), Dunkirk (18)
*Middle (36–64):* The Godfather (45), Parasite (42), No Country for Old Men (50), Hereditary (48)
*Patient (65–100):* Aftersun (80), Kelly Reichardt films generally (78–85), Tarkovsky films (85–95), Jeanne Dielman (97), Wavelength (99)

---

### SPLIT CHARACTER / SPLIT DIMENSION NOTATION

Some films contain significant internal splits — where different characters, storylines, or sequences pull strongly toward opposite poles on the same dimension. When this applies:

- Score based on the **dominant viewer experience**
- Add a **(split — see note)** flag to the score
- Explain the split briefly in Notable Tensions

Example: `38 (leans Realistic — split, see note)` with a note: "Moss and Bell behave with psychological realism; Chigurh is explicitly archetypal by design. The split is intentional."

Do not average the two poles into a false middle. Name the dominant experience and flag the split.

---

### MESSY MIDDLE FLAG

After scoring all 12 dimensions, count how many score clearly at an extreme (0–35 or 65–100). If the film has **fewer than 3 dimensions scoring at an extreme**:

Mark the film: **⚠️ INTERVIEW PRIORITY — messy middle film**

This signals that the film has insufficient informative signal for contradiction analysis. When a user has rated this film highly, it should be addressed in the taste interview using the Undetermined Film Protocol (see TASTE_INTERVIEW_SKILL.md).

A film can score in the middle on many dimensions and still not be flagged — as long as at least 3 dimensions produce clear extreme scores. The flag measures the **presence of useful signal**, not the count of middle scores.

---

### STORAGE

All three phases produce data stored on the `films` record:

| Data | Field |
|------|-------|
| TMDb metadata | `title`, `year`, `director`, `poster_path`, `backdrop_path`, `synopsis`, `runtime_minutes`, `cast_json`, `keywords`, `tmdb_genres` |
| AI brief | `ai_brief` (JSONB) — contains `emotional_question`, `tone`, `genres`, `themes`, `discourse`, `scenes`, `craft`, `performances`, `viewer_fit` |
| Dimension scores | `dimensions_v2` (JSONB) — 12 keys, integer values 0–100 |

The old `dimensions` field inside `ai_brief` (6-value -1 to 1 scale: pace, story_engine, tone, warmth, complexity, style) is **deprecated** — it is no longer used and should not be generated in new enrichments.

---

### CONSTRAINTS

- Do not conflate **genre** with dimension scores. A horror film can score anywhere on most dimensions.
- Do not conflate **quality** with scores. Good or bad is irrelevant to position on these spectrums.
- Do not conflate **popularity or obscurity** with the Accessible ←→ Demanding dimension.
- Do not conflate **age or country of origin** with scores.
- If a film is unknown, say so. Do not fabricate scores.
- When a dimension has a significant internal split, name the dominant experience and flag the split — do not average into a false middle.
