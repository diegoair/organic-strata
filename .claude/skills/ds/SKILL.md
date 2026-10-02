---
name: ds
description: Run the design-system agent. `/ds consult <what is about to be built>` for a build brief before any UI work, `/ds review` to check the current diff before a commit, `/ds audit` for the state of the system, `/ds document <what changed / what was decided>` to update the docs, the live reference and the decision register. Use when Diego asks to check something against the design system, or before/after UI work.
---

# /ds — the design-system agent

The agent is defined in `.claude/agents/design-system.md`; its ledger is
`docs/DESIGN-DECISIONS.md`; its instrument is `scripts/ds-audit.py`.

1. Take the mode from the first word of the arguments (`consult` / `review` / `audit` /
   `document`). No argument: `review` if the working tree has UI changes
   (`git status --short` shows `.html` / `.css` / `shared/*.js`), otherwise `audit`.
2. Spawn the `design-system` subagent (Agent tool, `subagent_type: "design-system"`). The
   prompt starts with the mode in capitals, then everything it cannot work out alone:
   - **CONSULT** — what is being built, in which tool, what it must do, what Diego said about it.
   - **REVIEW** — which change (working tree, or a ref), and what it was meant to do.
   - **AUDIT** — nothing more, unless a scope was given ("only motion", "only FVS").
   - **DOCUMENT** — what shipped and what Diego decided, in his words.
   If the `design-system` agent type is not available in this session (it was created or
   edited after the session started), spawn a general-purpose agent and tell it to read
   `.claude/agents/design-system.md` first and act as that agent.
3. Relay the result to Diego: the verdict or brief first, then the findings that need
   action, then **the decisions that are his** as a short list. Do not paste the whole report.
4. After a REVIEW that says BLOCK, fix the findings before committing. After a CONSULT with
   gaps, ask Diego before building around them. Never answer an owner decision yourself.
