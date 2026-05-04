# Skill: Competitive Analysis
_Invoke by saying: "competitive analysis: [feature or area]"_

---

## What this skill does

Claude researches how competitors and adjacent products handle a specific feature or problem area, then presents a structured analysis with takeaways for sp-reels.

---

## Competitors and adjacent products to know

**Direct competitors (taste + film)**
- Letterboxd — social film diary, ratings, lists; dominant in the space
- Taste.io — taste-based film recommendations (largely defunct)
- Criticker — compatibility scoring between users; early take on taste matching
- FilmAffinity — affinity-based recommendations, European user base

**Streaming platforms (recommendation systems)**
- Netflix — most sophisticated consumer rec system; extensive A/B testing public record
- Spotify (Discover Weekly) — best-in-class taste profiling for music; transferable lessons
- Apple TV+ / Prime Video — taste signal from watch time, not just ratings

**Taste profiling adjacent**
- Goodreads — book ratings and shelving; useful for sp-books comparison
- Last.fm — music listening history → taste profile; early collaborative filtering
- Pandora (Music Genome Project) — dimension-based taste modeling; direct analog to our 12 dims
- StumbleUpon / Pinterest — implicit signal from browsing behavior

**Group decision tools**
- Netflix Party / Teleparty — co-watching, not decision-making
- Flixtape — lightweight shared watchlist
- Rave — group watching with chat

**MBTI / personality profiling**
- 16Personalities — how they present personality types accessibly; UX reference for taste code
- Spotify Wrapped — how they make taste data feel personal and shareable

---

## Analysis format Claude returns

```
## [Feature]: Competitive Analysis

### How [Competitor 1] handles it
[What they do, screenshots/links if findable, what works, what doesn't]

### How [Competitor 2] handles it
[...]

### Patterns across the field
[What's common, what's missing, where the gap is]

### Takeaways for sp-reels
- [Specific actionable insight]
- [Specific actionable insight]
- [What we should do differently / better]
```

---

## How Claude does the research

1. Web search each competitor's current product for the specific feature
2. Look for app store reviews, blog posts, or interviews that reveal how users respond to it
3. Search for any public technical writing (engineering blogs, research papers) about their approach
4. Synthesize — don't just summarize each one, find the pattern and the gap

---

## Example invocations

- "competitive analysis: group film selection / deciding what to watch together"
- "competitive analysis: how do taste platforms handle cold start (new users with no history)?"
- "competitive analysis: how does Letterboxd present taste / profile information?"
- "competitive analysis: personality-type systems — how do they present identity codes to users?"
- "competitive analysis: how do streaming platforms explain why they're recommending something?"
