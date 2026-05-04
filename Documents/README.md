# sp-reels — How We Operate
_Last updated: 2026-05-04_

This document explains how we collaborate, how the documentation system works, and how to use it efficiently.

---

## The document system

Everything lives in this `Documents/` folder inside the repo. It is version-controlled with git.

```
Documents/
  README.md         ← you're here
  vision.md         ← north star, principles, what this is and isn't
  roadmap.md        ← current phase, next items, phase sequence, locked decisions
  prds/             ← one PRD per epic; living documents
    prd-taste-profile.md
    prd-logging.md
    prd-social.md
    prd-discovery.md
    prd-onboarding.md
    prd-recommendations.md
  skills/           ← reusable workflows Claude can execute on command
    roadmap-review.md
    session-sync.md
    film-enrichment.md
```

Claude's memory folder (`~/.claude/projects/.../memory/`) is a lightweight index that points here. All substantive content lives in this folder.

---

## How PRDs work

- **One PRD per epic.** Each covers a major experience area.
- **Each PRD has three sections per feature:**
  - *What's built* — everything implemented and working
  - *Design decisions* — choices made and why (locked unless revisited explicitly)
  - *Open requirements* — the backlog for this epic; things to build
- **PRDs are living documents.** As we talk about a feature, requirements move from "open" into "built." New ideas get added to "open requirements."
- **New epic threshold:** If a new area of work doesn't fit cleanly into any existing epic, ask Claude: "Does this deserve its own epic?" Claude will assess and recommend.

---

## How the roadmap works

- **roadmap.md** tracks the current phase and upcoming phases in rough sequence.
- When you say "move this to later," Claude adds it to the relevant PRD's open requirements (not the roadmap). The roadmap shows phases, not every ticket.
- When a phase is underway, specific features move from the roadmap into PRDs where requirements are fleshed out.

---

## How to update the docs

When you want the docs updated, say: **"update the docs"**

Claude will:
1. Read what has been discussed in the session
2. Update relevant PRD "what's built" and "open requirements" sections
3. Update roadmap if phase status changed
4. Ask clarifying questions before writing if anything is ambiguous

Claude does **not** auto-update docs without being asked — you control when the snapshot happens.

---

## Skills you can invoke

Say the skill name to trigger it.

### "roadmap review"
Claude reads `vision.md`, `roadmap.md`, and all PRDs. Returns:
- What's in progress right now
- What's next given the north star
- What open requirements across all PRDs are most impactful
- Any recommendations on priority shifts

### "session sync"
Claude reads everything discussed in the session that hasn't been logged, evaluates where it fits, asks 1–3 clarifying questions if needed, then updates the right PRDs and roadmap.

### "film enrichment"
See `skills/film-enrichment.md` for the film brief generation workflow.

---

## Epics at a glance

| Epic | PRD | Status |
|---|---|---|
| Taste Profile | prd-taste-profile.md | Core built, actively refining |
| Logging | prd-logging.md | Core built, interview needs improvement |
| Social | prd-social.md | Core built |
| Discovery | prd-discovery.md | Catalog built, Mood Room designed (not built) |
| Onboarding | prd-onboarding.md | Partial — calibration built, full first-run incomplete |
| Recommendations | prd-recommendations.md | Foundations only |
