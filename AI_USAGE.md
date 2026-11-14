# AI usage: how this project was built with agents

## Tools
- Planning and grilling session: Claude Opus 5.5, chat in claude.ai (course prompt template).
- Prototypes (proof-of-concept page, mouse-intent demo): Claude Opus 5.5 in claude.ai.
- Building the project: Claude Code with Claude Opus 5.5, run in this repo on Windows.

## Workflow
- `SPEC.md` (from the grilling session) is the brief; `CLAUDE.md` and the project skill
  `.claude/skills/survey-mode-builder` tell the agent how to work, test, document and deploy.
- Tasks are given one checkpoint step at a time; each step is checked in the browser
  (`tests.html`, the live site, `?demo=1`) before moving on.

## Division of labor
(fill in as the project goes)

## Verification
(fill in: which tests, hand-checked example, brute-force comparison, Python cross-check)

## Reflection
(write at the end)

## Lab notebook (one entry per session, newest last)

- 2026-10/11 (claude.ai): Explored project ideas; built a cursor-intent HMM demo.
  [EPISODE] First version assumed people aim at box centers, so a diagonal toward B was read as
  A. Caught by testing it myself; fixed by aiming at the radio buttons. A second trial then
  failed because I clicked the box, not the circle; fixed by scoring the whole box plus a
  closeness term. Lesson: test the agent's model on your own behavior.
- 2026-11-14: Proof-of-concept page with the full 4-state HMM; in-browser checks (hand-worked
  example, brute force on 500 random models, 2,000-step underflow test) all pass. Set up repo
  folder, CLAUDE.md and agent skill.
