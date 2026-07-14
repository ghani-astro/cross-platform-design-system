# Backbone

> An AI-native Design System Editor — define tokens visually, ship them as `tokens.json` / `variables.css` / `tailwind.css` / `DESIGN.md` / `.cursorrules` for AI coding tools to consume.

Built with vanilla HTML/CSS/JS — single-file architecture, no framework, no build step.

## ✨ Features

**Token sections** — 8 categories, all editable with inspector + live preview:

| Section | What |
|---|---|
| **Color** | OKLCH primitive palettes + semantic tokens, Light/Dark mode pairs, WCAG contrast badges |
| **Typography** | Font families (Google Fonts + System), 5 primitive scales, 18 default text styles, 4 starter packs |
| **Spacing** | T-shirt scale (3xs → 4xl), visual bar previews, required use cases |
| **Sizing** | Controls (xs → 3xl) + Containers (sm/md/lg), WCAG touch-target badge ≥44px |
| **Radius** | 8 stops (none/xs/sm/md/lg/xl/2xl/full), curved tile previews |
| **Shadow** | 8 entries (xs–xl + inner/focus/glow), CSS box-shadow with multi-layer support |
| **Breakpoints** | 3 ranges (mobile/tablet/desktop), derived media queries |
| **Motion** | Durations + Easings, live bouncing-dot preview, prefers-reduced-motion fallback |

**Auth flow** — `login.html` (magic-link), `register.html`, `onboarding.html` (workspace setup wizard), `dashboard.html` (workspace list + sign out).

**Save flow** — baseline snapshots, dirty-state tracking, sticky save bar, grouped diff preview modal, beforeunload warning, discard/restore.

**Export modal** — 6 formats:
- `tokens.json` — W3C Design Tokens (DTCG) — Style Dictionary, Tokens Studio
- `tokens.flat.json` — Flat key/value for AI prompt context
- `variables.css` — Standard CSS custom properties + `.dark` class
- `tailwind.css` — Tailwind v4 `@theme` block
- `DESIGN.md` — Markdown docs with AI Instructions block
- `.cursorrules` — Cursor IDE rules

ZIP download includes auto-generated README.

## 🚀 Quick start

```bash
git clone https://github.com/priakusumawardana-astro/backbone.git
cd backbone
python3 -m http.server 8080
open http://localhost:8080/login.html
```

Magic-link is mock — type any email, click "Continue" to enter the editor.

## 📂 Project structure

```
backbone/
├── index.html          # Editor app (~365KB, single file with all logic)
├── login.html          # Magic-link sign in
├── register.html       # Sign up (4 fields)
├── onboarding.html     # Workspace setup wizard
├── dashboard.html      # Workspace list + sign out
├── screenshots/        # 21 UI captures @ 2x DPR for Figma reference
└── README.md           # This file
```

## 🎨 Design

- **Aesthetic**: Warm off-black canvas + signature electric chartreuse accent
- **Typography**: Geist (display + body), JetBrains Mono (tokens + code)
- **Color space**: OKLCH throughout, gamut-aware
- **Dark mode**: First-class; Light mode via `.theme-light` body class
- **References**: Linear, Vercel, Figma — clean, focused, professional with personality

## 🤖 AI Tools integration

The exported `DESIGN.md` + `.cursorrules` are designed for:

- **Cursor** — drops `.cursorrules` at repo root → AI restricted to use defined tokens
- **Claude Code** — `CLAUDE.md`-compatible Markdown docs
- **Lovable / Bolt / v0** — paste DESIGN.md as context, AI generates UI using your tokens
- **GitHub Copilot** — `AGENTS.md` format planned

## 🛠 Tech

- Vanilla HTML/CSS/JS — no framework, no build step
- OKLCH color math via `culori`-style helpers (inline)
- Google Fonts CDN for typography preview
- JSZip via CDN (lazy-loaded) for export bundling
- Single-file architecture preserved throughout

## 🗺 Roadmap

- [ ] Per-tab edit mode (currently global)
- [ ] Color Settings modal consolidating Light/Dark, Lightness, Stops, Presets
- [ ] Empty states for Primitives + Semantic sections
- [ ] Predefined color libraries (Tailwind, Radix, Polaris, Material 3)
- [ ] MCP server for direct AI tool integration
- [ ] GitHub sync for token files
- [ ] Real backend (Supabase / Convex) replacing localStorage mock

## 📸 Screenshots

See `/screenshots/` directory for 21 UI captures (2880px wide, Retina).

---

Built with [Claude Code](https://claude.com/claude-code).
