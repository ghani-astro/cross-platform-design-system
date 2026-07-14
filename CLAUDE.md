# Astro Cross-Platform Design System

This directory is the working hub for a large task: unifying Astro's design
tokens into one cross-platform source of truth that feeds Android, Web, and
(later) iOS. This file holds the loaded context. Nothing is built here yet.

Parent folder: `/Users/malikabdulghani/Documents/Astro/` holds all the sibling
repos referenced below (Android, web, iOS, and the design-system libs).

---

## 1. The two things checked first

### Backbone (internal design-token editor)
- Demo: https://backbone-git-main-rockerpower-s-projects.vercel.app/dashboard.html
- Sign in is mock auth. Any valid email format works, no real email is sent.
  Click "Open Demo Workspace" to enter.
- What it is: a web app to author and edit design tokens, then open pull
  requests. Three-tier token model:
  - Primitives: 22 color palettes (50 to 900 ramps), plus Typography, Spacing,
    Sizing, Radius, Shadow, Border scales.
  - Semantic: 34 named roles that point at primitives (text.primary,
    background.subtle, surface.raised, border.focus, brand.solid, danger.solid,
    success.solid, etc.).
  - Component: per-component slots (Button, Card, Input, Badge) that map to
    semantic tokens. Preset is shadcn/ui.
- Has Light and Dark values per token (ref / refDark). Import and Export tokens
  (export target mentioned is "shadcn/ui theme" for globals.css).
- Role in the big picture: Backbone is one of the authoring surfaces named in
  the TRD. It never holds the truth, it opens PRs into the token repo.

### TECH-138 (Jira)
- https://astronauts-id.atlassian.net/browse/TECH-138
- Title: [NEW SERVICE+REPO] [astro-pricing-engine-be] PROPOSAL. Type Task,
  status Done, from mid-2024.
- Content: a proposal to split pricing out of the IMS service into a new Go /
  gRPC backend, `astro-pricing-engine-be` (Postgres, MongoDB, PubSub).
- IMPORTANT: this ticket is a backend pricing service. It does not obviously
  connect to the design-system work. Kept here because it was part of the
  initial context load. Confirm with the requester how (or if) it relates.

---

## 2. Reference TRD (Confluence) - NOT a baseline

- https://astronauts-id.atlassian.net/wiki/spaces/ASTRO/pages/2175434801
- Title: "Astro Design System - Technical Requirements Document". Status is
  Proposal / RFC.
- Per the requester: DO NOT treat this TRD as the baseline or foundation. It
  will change later. Use it as background only, not as authoritative spec.

What it currently proposes (summary):
- One shared source of truth: design tokens as DTCG JSON in a single Git repo,
  `main` is canonical.
- Authoring surfaces: Figma libraries and Backbone. Both push edits through
  pull requests, they never hold the truth.
- On merge, CI runs Style Dictionary and publishes three packages:
  - Android: AAR `com.astro.design:tokens` (Compose theme + token objects).
  - iOS: SPM `AstroDesignTokens` (SwiftUI accessors + asset catalog).
  - Web: npm `@astro/design-tokens` (CSS custom properties + typed TS).
- Three native catalog apps act as living docs and visual-regression baselines.
- Token tiers: Primitive (private palette) to Semantic (app-facing API) to
  Component. Apps consume the semantic tier.
- Phased delivery: P1 tokens (light + dark), P2 adds low-level components,
  P3 full library. TRD details P1.
- Open questions in the doc: registry choice (Maven Central vs GitHub
  Packages, public vs private npm), value-change semver policy, visual
  regression tooling, Figma vs Backbone authority, P1 timeline per app team.

Note: the package names in the TRD (`com.astro.design:tokens`,
`@astro/design-tokens`) differ from what the repos publish today (see below).
The TRD describes a target, not the current state.

---

## 3. Platforms and repos loaded

### Android app: astro-buyer-android
- Path: `/Users/malikabdulghani/Documents/Astro/astro-buyer-android`
- Buyer-facing Android app. Multi-module + Clean Architecture (MVVM), Koin DI.
- UI: Jetpack Compose (effectively Compose-only). Material 2 primary, some
  Material 3, plus legacy Material Components XML in `core-design`.
- Layout: `shop/` (app module), `core/` (~17 infra modules incl. `core-compose`
  and `core-design`), `data/` (~20 data modules), `features/` (~13 features),
  `build-logic/` (convention plugins).
- Consumes the shared design system as a REMOTE Maven artifact:
  `com.astro.shop:design-system:0.0.20` (see `gradle/libs.versions.toml`,
  alias `astroDesignSystem`). Used in `core/core-compose`, `core/core-baseclass`,
  `shop`, and several feature modules.
- `core/core-compose` is the app-side adapter over the shared lib. UI is wrapped
  in `AstroTheme { }` and reads `AstroTheme.colors/typography/dimensions/icons`.
- Legacy local theming still present and NOT from the shared lib:
  `core/core-compose/.../theme/Color.kt` (hardcoded hex palette) and the
  `core-design` XML "Unify" layer.
- Build: Gradle Kotlin DSL, AGP 8.13.2, Kotlin 2.3.10, Compose BOM 2025.12.00,
  min SDK 24 / target 35 / compile 36. App version 4.21.0.
  (README version numbers are stale, trust `gradle/libs.versions.toml`.)

### Android design system lib: astro-android-libs
- Path: `/Users/malikabdulghani/Documents/Astro/astro-android-libs`
- Gradle monorepo of Astro Android libs. The design system is the
  `design-system/` project, published as `com.astro.shop:design-system:0.0.20`
  to Google Artifact Registry (asia-southeast2). Only Jenkins cuts releases.
- Library source: `design-system/design-system/src/main/java/com/astro/design/system/`
  organized by atomic design: `token/`, `atom/`, `semimolecule/`, `component/`,
  `builder/spotlight/`, `ext/`.
- Tokens are hand-authored Jetpack Compose Kotlin objects (not generated, not
  XML):
  - `token/AstroColors.kt`: brand ramps `primaryGalaxy0..15` (galaxy blue),
    `secondaryNebula1..15` (nebula red), `neutralNeutral1..12`, system ramps,
    semantic aliases. Example: `primaryGalaxy8 = Color(0xFF246EE5)`.
  - `token/AstroTypography.kt`: Nunito Sans, display/headline/body/caption scale.
  - `token/AstroDimens.kt`: spacing (xxsm 2dp to 14xl 128dp), font sizes, line
    heights, radius (xxsm 2dp to xl 999dp pill).
  - `token/Shadow.kt` + `AstroShadow.kt`: custom inner-shadow, no Material
    elevation.
- Theming: custom CompositionLocal theme (`AstroTheme`), Material 2, single
  hardcoded light palette. NO light/dark switching yet (dark values are baked
  into separately named tokens).
- ~55+ components (atoms + semi-molecules). No Card component today; inputs are
  AstroTextField / AstroTextArea / AstroSearchTextField / AstroPinInput.

### Web app: astro-mobile-web ("Astro web lite")
- Path: `/Users/malikabdulghani/Documents/Astro/astro-mobile-web`
- pnpm monorepo, workspace glob `apps/*`, no shared `packages/`. Apps are
  self-contained.
  - `apps/astro-mobile-web`: mobile-first e-commerce PWA, Next.js 14 App
    Router, React 18, TS strict, Zustand, React Query, next-intl.
  - `apps/core-app`: WebView support app for the native app, Vite + React 19.
- Consumes the design system via npm from GitHub Packages (`@astronautsid`
  registry), NOT a local package:
  - `@astronautsid/wpe-astro-ui` (2.23.1 in mobile-web) = components + theme +
    tokens.
  - `@astronautsid/wpe-icons`, `@astronautsid/wpe-utils`.
- Styling: MUI + Emotion (MUI v5 mobile-web, v7 core-app). No Tailwind.
- Theme wiring: `createTheme('light', ...)` / `customTheme('light')` from
  `@astronautsid/wpe-astro-ui/theme`, wrapped in `<AstroUIProvider>`.
  Tokens imported from `@astronautsid/wpe-astro-ui/tokens/color` and `/text`.
- No local token source of truth. Local files only extend the DS theme.
- Tooling: pnpm 9, Node 22.

### Web design system lib: astro-fe-lib
- Path: `/Users/malikabdulghani/Documents/Astro/astro-fe-lib`
  (cloned from https://github.com/astronautsid/astro-fe-lib)
- This IS the repo that publishes `@astronautsid/wpe-astro-ui`, so it is
  astro-mobile-web's design system. The repo name just differs from the npm
  name.
- Nx + pnpm monorepo. Published packages under `packages/`:
  - `astro-ui` to npm `@astronautsid/wpe-astro-ui` (components + tokens + theme).
  - `icons` to `@astronautsid/wpe-icons` (~250 React SVG icons).
  - `utils` to `@astronautsid/wpe-utils`.
  - `eslint-config` to `@astronautsid/eslint-config`.
- Tokens: typed TS constant objects in `packages/astro-ui/src/tokens/`, consumed
  by MUI `createTheme`. Same design language as Android:
  - `color.ts`: `galaxy` ramp (`galaxy-8: '#246EE5'`), `nebula` ramp,
    `neutral-1..12`, system colors, semantic groups (btnPrimary, textColor,
    iconColor, strokeColor, bgColor).
  - `text.ts`: Nunito Sans, display/headline/body/paragraph/caption scale.
  - `spacing.ts` (xxsm 2 to 14xl 128), `radii.ts` (xxsm 2 to xl 999),
    `elevation.ts`, `breakpoints.ts`.
- Token pipeline: Nx `token` target downloads `tokens.json` from GitHub repo
  `astronautsid/astro-design-token` (Figma-style tokens), then runs
  token-transformer to produce the TS token files. So web tokens are already
  generated from an external Figma token repo.
- Styling: MUI v5 + Emotion. Theming via MUI ThemeProvider (`AstroUIProvider`),
  runtime JS, not CSS variables or data-theme. Light and dark exist but the
  dark palette is currently a stub.
- Build: Vite library mode, ESM output, multi-semantic-release, GitHub Packages.

---

## 4. Current state: the token alignment gap

The single most important finding:

Android and Web already share the SAME token design language, but authored in
three different places with no single source of truth.

- Same brand ramps: galaxy (blue) and nebula (red), plus neutral 1..12.
- Same font: Nunito Sans.
- Same scales: spacing (2 to 128), radius (2 to 999 pill).
- Same values: `galaxy-8 = #246EE5` on Web equals `primaryGalaxy8 = 0xFF246EE5`
  on Android. `textColor.error = #F94D63` matches on both.

Where the values live today:
- Web (astro-fe-lib): generated from Figma token repo
  `astronautsid/astro-design-token`, output as TS objects for MUI.
- Android (astro-android-libs): hand-authored Kotlin objects, maintained
  separately.
- iOS: repos exist in the parent folder (astro-buyer-ios, astro-buyer-ios-ads,
  astro-buyer-ios-liquid-glass, astro-buyer-ios-aichat) but were NOT loaded in
  this session.

The cross-platform task is to close this gap: one source of truth (DTCG JSON,
per the TRD direction, subject to change) that generates the Android, Web, and
iOS token packages so a value can never drift between platforms.

Candidate existing source: `astronautsid/astro-design-token` already feeds the
web lib. Worth evaluating as the seed for the unified repo.

---

## 5. Implementation (built in this repo)

This repo IS the cross-platform design system now. Remote:
git@github.com:ghani-astro/cross-platform-design-system.git (org move to
astronautsid as astro-cross-platform-design-system proposed in PROPOSAL.md).

Layout:
- `tokens/tokens.json`: canonical DTCG source of truth (349 tokens: 149 color
  primitives, 115 semantic colors, 22 spacing, 7 radius, typography incl. 26
  text styles). Seeded from the real Astro values, verified by 4510 assertions.
- `tokens/platform-names.json`: DTCG path to platform name map (mirror naming:
  android `primaryGalaxy8`, web `galaxy-8`). Generators depend on it.
- `editor/`: **Nova**, the token editor web app (vendored Backbone + our
  GitHub Sync feature in `editor/github-sync.js`). Later served on the VPS.
- `generators/`: android.mjs, ios.mjs, web.mjs (plain node, no deps).
- `packages/android/`: Gradle project, AAR `com.astro.design:tokens`
  (GitHub Packages Maven). Compose ui-graphics/ui-unit only, minSdk 24.
- `Package.swift` + `Sources/AstroDesignTokens/`: SPM package, iOS 15 / macOS 11.
- `packages/web/`: npm `@ghani-astro/design-tokens` (GitHub Packages npm),
  generated index.mjs + index.d.ts + tokens.css, no build step.
- `.github/workflows/`: pr-validate.yml (PRs touching tokens/generators),
  release.yml (merge to main: regenerate, patch-bump VERSION, tag vX.Y.Z,
  publish AAR + npm; SPM consumes the tag).
- `VERSION`: single source of package version.

## 6. Naming conventions (IMPORTANT)

- **Nova** = the editor web app in `editor/` (the Backbone-based token editor
  with the Sync button that opens PRs to this repo). When the user says
  "nova", they mean this app.
- **Astro web lite** = the frontend web app repo `astro-mobile-web`.
- Integration branches in the three consumer repos are all named
  `cross-platform-design-system`: astro-buyer-android off `master`,
  astro-buyer-ios off `main`, astro-mobile-web off `production`.

## 7. "rebuild all now" protocol

When the user says "rebuild all now" (or similar), rebuild ALL THREE consumers
against the LATEST published package version:
1. Find the latest release: `gh release list -R ghani-astro/cross-platform-design-system`
   (or latest vX.Y.Z tag).
2. Android (astro-buyer-android, branch cross-platform-design-system): set
   `astro-design-tokens-version` in gradle/libs.versions.toml to the latest,
   build the app (stagingDebug variant).
3. iOS (astro-buyer-ios, branch cross-platform-design-system): bump the
   AstroDesignTokens version rule in xcodegen/packages.yml, run xcodegen,
   resolve packages and build (DebugStaging scheme).
4. Web (astro-mobile-web, branch cross-platform-design-system): bump
   `@ghani-astro/design-tokens` in apps/astro-mobile-web/package.json,
   pnpm install, run tsc-check and build.
5. Report per-platform results honestly.

## 8. Credentials

- gh CLI is authenticated as ghani-astro (active) with repo + workflow scopes.
- The user placed a classic PAT (repo + read:packages) themselves in:
  astro-buyer-android/local.properties (gpr.user/gpr.key) and ~/.npmrc
  (npm.pkg.github.com _authToken). NEVER read, print, or move those values.
- Nova stores its PAT in browser localStorage, pasted by the user in its
  Sync settings form.
- CI publishing uses GITHUB_TOKEN only, no extra secrets.

## 9. Conventions for this conversation
- No em dashes anywhere. Keep answers simple and direct.
- The TRD is reference only and will change. Do not lock decisions to it.
- RTK (Rust Token Killer) proxy is active via a global hook and rewrites CLI
  commands transparently.
