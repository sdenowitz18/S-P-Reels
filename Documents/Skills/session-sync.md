# Skill: Session Sync
_Invoke by saying: "update the docs" or "session sync"_

---

## What this skill does

At the end of a working session, Claude reads everything that was built or discussed, figures out where it belongs, and updates the documentation — PRDs and roadmap — to reflect current reality.

---

## Steps Claude takes

1. **Scan the session** — identify everything built, decided, or discussed that isn't yet in the docs
2. **Classify each item**:
   - New feature built → move to "What's built" in the right PRD
   - Open requirement completed → move from "Open requirements" to "What's built"
   - New idea / future requirement → add to "Open requirements" in the right PRD
   - New epic-worthy area → flag and ask "Should this get its own PRD?"
   - Roadmap phase completed or changed → update `roadmap.md`
   - New locked design decision → add to roadmap decisions table
3. **Ask before writing** — if anything is ambiguous (where it belongs, whether it's done or just discussed), ask 1–3 clarifying questions first
4. **Write the updates** — modify the relevant files
5. **Report** — summarize what was updated and where

---

## Rules

- Do NOT mark something as "built" unless it was confirmed working in the session
- Do NOT delete open requirements unless explicitly told they're dropped
- Do NOT auto-update without being asked — wait for "update the docs" or "session sync"
- If a new area doesn't fit any existing epic, say so and propose a new PRD

---

## Clarifying questions Claude may ask

- "Was [X] fully shipped or still in progress?"
- "Should [Y] go in `prd-logging.md` or `prd-recommendations.md`?"
- "Is [Z] dropped from the roadmap or just deferred to later?"
- "You mentioned [W] — is this a new epic or a feature within Discovery?"

---

## When to use

Say **"update the docs"** at the end of any session where:
- New features were built
- Requirements were discussed or refined
- Roadmap priorities changed
- New ideas came up that should be captured
