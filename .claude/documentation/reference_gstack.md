---
name: reference-gstack
description: gstack slash-command skills toolkit by Garry Tan — installation, full skills list, and how to use on the MaxMusic project
metadata:
  type: reference
---

# gstack Reference

**Source:** https://github.com/garrytan/gstack
**What it is:** 23+ specialized slash-command skills + 8 power tools that transform Claude Code into a virtual engineering team.

## Installation
```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```
Requirements: Claude Code, Git, Bun v1.0+, Node.js (Windows only)

## Sprint Workflow
Think → Plan → Build → Review → Test → Ship → Reflect

## Core Skills Cheat Sheet

| Skill | Purpose |
|-------|---------|
| `/office-hours` | Product interrogation before coding |
| `/plan-eng-review` | Architecture locking, data flow, edge cases |
| `/plan-ceo-review` | Strategic scope review |
| `/autoplan` | Auto pipeline: CEO → design → eng review |
| `/design-shotgun` | 4-6 visual mockup variants with taste memory |
| `/design-html` | Mockup → production HTML/CSS (30KB, zero deps) |
| `/design-consultation` | Full design system generation from scratch |
| `/design-review` | Post-ship design audit |
| `/review` | Staff engineer code review with auto-fixes |
| `/cso` | Chief Security Officer: OWASP Top 10 + STRIDE |
| `/qa` | QA lead with real Playwright browser testing |
| `/qa-only` | Bug reporting without code changes |
| `/ship` | Release: sync, test, audit, push, open PR |
| `/investigate` | Root-cause debugging with hypothesis testing |
| `/spec` | Intent → precise executable specifications |
| `/canary` | Post-deploy: console errors + perf regressions |
| `/benchmark` | Core Web Vitals before/after comparison |
| `/careful` | Warn before destructive commands |
| `/freeze` | Lock edits to specific directories |
| `/guard` | `/careful` + `/freeze` combined |
| `/browse` | Real Chromium browser with anti-bot stealth |
| `/learn` | Manage learned patterns and preferences |
| `/setup-gbrain` | Persistent knowledge base (local or Supabase) |
| `/document-release` | Auto-update docs after shipping |
| `/codex` | Second opinion from OpenAI Codex CLI |
| `/retro` | Weekly engineering retrospective |

## Key Usage Notes
- **Not automated agents** — you manually trigger each skill
- **Claude Pro constraint**: skills read many files; run after build sessions, not during them
- **/cso is the most important** for this project — run after Phase 2 (middleware) and Phase 5 (v2 controllers)
- Always tell /cso: "Check every MongoDB query in v2 controllers for institutionId filter"
- /qa uses real Playwright browser — needs the app running locally first
- /gbrain = persistent knowledge base across sessions (Supabase or local PGLite)

## How to Feed Context Before Running a Skill
```
"Read .claude/CLAUDE.md and .claude/CONTRACTS.md first, then run /cso"
```

**Why:** [[project-maxmusic]] — see GSTACK.md in project for MaxMusic-specific skill schedule
