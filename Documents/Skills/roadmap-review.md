# Skill: Roadmap Review
_Invoke by saying: "roadmap review"_

---

## What this skill does

Claude reads the full context — vision, roadmap, and all PRDs — then surfaces:
1. What is in progress right now
2. What should come next given the north star
3. Which open requirements across all PRDs are highest impact
4. Any recommended priority shifts or things that feel missequenced

---

## Steps Claude takes

1. Read `Documents/vision.md` — north star and principles
2. Read `Documents/roadmap.md` — current phase, phase sequence, locked decisions
3. Read all PRDs in `Documents/prds/` — what's built and what's open
4. Cross-reference: which open requirements are blocking the north star most?
5. Return a concise brief:
   - **Now**: what's actively being worked on
   - **Next**: top 2–3 recommended items to tackle next
   - **Later**: anything currently sequenced that feels out of place
   - **Gaps**: anything important that isn't captured anywhere yet

---

## Output format

```
## Now
[what's in flight]

## Next (recommended)
1. [item] — [why it moves the needle]
2. [item] — [why it moves the needle]
3. [item] — [why it moves the needle]

## Watch list
- [anything that feels missequenced or de-risked by doing something first]

## Gaps noticed
- [things discussed but not captured in any PRD or roadmap]
```

---

## When to use

- Start of a new session when you want to orient before building
- After a long string of tactical work to zoom back out
- When deciding between competing priorities
- When you feel like you might be building the wrong thing
