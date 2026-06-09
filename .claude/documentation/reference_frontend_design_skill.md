---
name: reference-frontend-design-skill
description: frontend-design Claude Code skill — how to trigger it, what it produces, design philosophy for production-grade distinctive UIs
metadata:
  type: reference
---

# Frontend Design Skill Reference

**Source:** https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md

## When to Use
Trigger this skill (or apply its principles) when:
- Building web components, pages, or full UI applications
- The goal is production-grade, visually distinctive interfaces
- Avoiding generic AI aesthetics is a priority

## Core Design Thinking Process (Before Coding)

1. **Purpose** — What problem does this solve? Who uses it?
2. **Tone** — Pick a bold aesthetic direction (see palette below)
3. **Constraints** — Technical requirements (framework, performance, accessibility)
4. **Differentiation** — What makes it unforgettable?

**Aesthetic palette options:** brutally minimal, maximalist, retro-futuristic, organic/natural, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial/utilitarian

## Typography Rules
- Choose beautiful, **unique**, distinctive fonts
- **Avoid:** Arial, Inter, Roboto, system fonts (these are generic)
- Pair a distinctive display font with refined body font

## Color Rules
- Commit to a cohesive aesthetic
- Use CSS variables for consistency
- Dominant colors with sharp accents — not timid, evenly-distributed palettes

## Motion Rules
- CSS-only for HTML; Motion library for React
- Focus on high-impact moments: orchestrated page loads, staggered reveals
- Scroll-triggering and hover states that surprise

## Spatial Composition
- Unexpected layouts: asymmetry, overlap, diagonal flow
- Grid-breaking elements
- Generous negative space OR controlled density (pick one, commit)

## Visual Details
- Gradient meshes, noise textures, geometric patterns
- Layered transparencies, dramatic shadows
- Decorative borders, custom cursors, grain overlays

## NEVER Use (Generic AI Aesthetics)
- Overused fonts: Inter, Roboto, Arial, system fonts
- Purple gradients on white backgrounds
- Predictable cookie-cutter component layouts

## Implementation Philosophy
- Maximalist vision → elaborate code with extensive animations
- Minimalist vision → restraint, precision, careful spacing/typography
- Every design should be unique and contextually appropriate

## MaxMusic Project Application
For the MaxMusic admin panel, the design language is already defined (hot pink #e91e8c, Inter font). When building new pages or the institution panels, apply these principles:
- The pink design system IS the committed aesthetic — be consistent, not generic within it
- Use micro-interactions on table sorts, modal opens, button hovers
- Institution panels: allow branding.primaryColor to override the CSS variable → institution gets its own flavor

**Why:** [[project-maxmusic]] uses Next.js 14 App Router with shared packages/ui components
