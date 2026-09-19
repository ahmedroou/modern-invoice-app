# Dispatch: Explorer M1-3 (RTL Direction, Theming & Responsive Layout)

**Agent Identity**: teamwork_preview_explorer_m1_3
**Working Directory**: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3
**Role**: RTL, Theming & Layout Specialist
**Milestone**: Milestone 1 (Foundation, Shell, Theming & RTL)

## Task Description
Investigate and specify the exact architecture for full Arabic RTL mirroring, CSS logical properties, Cairo/Tajawal offline font embedding, ThemeContext (light/dark), DirectionContext (ltr/rtl), and responsive mobile-first shell (collapsible sidebar, compact card design, mobile drawer).
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Output detailed implementation specifications in your `handoff.md`.

## 2026-09-19T04:29:12Z
You are teamwork_preview_explorer_m1_3.
Your working directory is: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3
Your task assignment is in: c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3\DISPATCH.md
Read:
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\ORIGINAL_REQUEST.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\PROJECT.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
- c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_survey_3\handoff.md

Investigate and specify the exact implementation for Arabic RTL mirroring, theming, and responsive UI shell:
1. src/context/DirectionContext.tsx managing dir="rtl" vs dir="ltr" and language ar vs en.
2. src/context/ThemeContext.tsx managing light vs dark with localStorage persistence.
3. CSS logical properties and Tailwind classes (ms-, me-, ps-, pe-, text-start, text-end, start-, end-) ensuring automatic bidirectional flipping.
4. Local offline font embedding (Cairo, Tajawal) in src/assets/fonts/ with @font-face in index.css so no external CDN is needed offline.
5. Responsive shell layout (AppLayout, Sidebar, MobileNav) adhering to mobile-first and compact card design rules.
Write your findings and code blueprints in c:\Users\ayami\Documents\antigravity\focused-hypatia\.agents\teamwork_preview_explorer_m1_3\handoff.md and report back via send_message.
