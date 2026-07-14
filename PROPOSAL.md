# [NEW SERVICE+REPO] [astro-cross-platform-design-system] PROPOSAL

> Template follows TECH-138 ([NEW SERVICE+REPO] [astro-pricing-engine-be] PROPOSAL).
> Status: Draft. Working implementation is being incubated at
> `github.com/ghani-astro/cross-platform-design-system` and would move into the
> `astronautsid` org as `astro-cross-platform-design-system` once approved.

| Section | Content |
| --- | --- |
| **Title of the New Service/Repo** *A clear and concise title that reflects the purpose of the new service or repository.* | astro-cross-platform-design-system |
| **Why New Service?** *Detailed justification for why this new service or repository is necessary. Include any business or technical requirements that it addresses.* | Astro design tokens are authored in three disconnected places today: hand-written Kotlin objects in astro-android-libs, TypeScript generated from the astro-design-token repo for web, and nothing for iOS. The values already match by convention (galaxy/nebula/neutral ramps, Nunito Sans, identical spacing and radius scales, e.g. #246EE5 is `primaryGalaxy8` on Android and `galaxy-8` on web), but nothing enforces that match. Any change must be re-entered by hand per platform, which is slow and drifts over time. This repo makes one canonical token source (DTCG JSON) plus an editor and a publish pipeline, so a single approved change fans out to Android, iOS, and web automatically. |
| **Evaluation of Existing Services** *A thorough investigation to ensure there are no existing services that can fulfill the same need.* | 1) `astro-android-libs` (design-system module, `com.astro.shop:design-system`): tokens are hand-authored Kotlin, no generation, no dark switching, Android only. 2) `astro-fe-lib` (`@astronautsid/wpe-astro-ui`): tokens generated from the `astro-design-token` Figma JSON, web only, MUI-shaped output. 3) `astronautsid/astro-design-token`: closest existing candidate, but it only feeds web, has no editor, no PR review flow, no versioned publishing, and no Android/iOS outputs. 4) iOS `UniverseUI` (module inside astro-buyer-ios): has its own local `tokens.json` (galaxy-1..15 etc.), decoded by Swift token structs, but it lives inside the app repo, is not published, and is a third hand-maintained copy of the same values. No existing repo covers authoring + review + multi-platform generation + publishing, so a new repo is required. Existing libs are not replaced in phase 1; they are consumers/peers of the generated packages. |
| **Project In Charge (PIC)** *Name and contact information of the team member who will be responsible for leading this project.* | Engineer: Malik Abdul Ghani (admin@malikghani.com). Product/Design: TBD. |
| **Roadmap for the Next 1 Year** *Roadmap outlining the development milestones.* | Q3 2026 (P1, in progress): token pipeline for colors, typography, spacing, radius. Backbone editor with Sync-to-PR. CI publishes AAR + SPM tag + npm on merge. Wire astro-buyer-android, astro-buyer-ios, astro-mobile-web on integration branches. Q4 2026: adoption in real screens, complete dark theme values, add sizing/shadow/breakpoints/motion categories, editor served on VPS. Q1 2027 (P2): semantic + component tier tokens (button, input, card slots), Figma sync into the same PR flow. Q2 2027 (P3): platform catalogs as living docs, visual regression as a release gate, full component mapping. |
| **Architecture Proposal and Dependencies** *A comprehensive architecture diagram of the proposed service, including external dependencies, data flows, and critical components.* | See diagram and component table below. Core flow: Backbone editor -> PR with tokens.json diff -> human approval -> merge to main -> CI generates Kotlin/Swift/TypeScript -> publishes `com.astro.design:tokens` (AAR, GitHub Packages Maven), `AstroDesignTokens` (SPM via git tag), `@ghani-astro/design-tokens` (npm, GitHub Packages) -> apps bump a version to consume. |

## Architecture

```
Backbone editor (editor/, static HTML/JS, later on VPS)
        |
        |  Sync button: shows change diff, user approves
        v
Pull Request to this repo (tokens/tokens.json, DTCG format)
        |
        |  review + merge to main
        v
GitHub Actions (release workflow)
        |
        |  generators/ (plain Node, no dependencies)
        |
   +----+---------------------+----------------------+
   |                          |                      |
   v                          v                      v
Kotlin constants         Swift constants        TS + MJS constants
packages/android         Sources/               packages/web
   |                          |                      |
   v                          v                      v
AAR to GitHub            git tag vX.Y.Z         npm to GitHub
Packages Maven           (SPM resolves it)      Packages registry
com.astro.design:tokens  AstroDesignTokens      @ghani-astro/design-tokens
   |                          |                      |
   v                          v                      v
astro-buyer-android      astro-buyer-ios        astro-mobile-web
(branch: cross-          (branch: cross-        (branch: cross-
platform-design-system)  platform-design-system) platform-design-system)
```

## Components

| Component | Type | Description |
| --- | --- | --- |
| tokens/tokens.json | Mandatory | Canonical DTCG token store. The only source of truth. |
| editor/ (Backbone) | Mandatory | Vanilla HTML/JS token editor. Vendored from priakusumawardana-astro/backbone and extended with GitHub Sync (PAT in localStorage, branch + commit + PR via GitHub REST API). |
| generators/ | Mandatory | Node scripts that read tokens.json and emit per-platform code that mirrors existing Astro naming (`primaryGalaxy8` Kotlin, `galaxy-8` TS, `AstroColor` Swift). |
| packages/android | Mandatory | Gradle project building the `com.astro.design:tokens` AAR. Depends only on Compose ui-graphics/ui-unit. |
| Package.swift + Sources/ | Mandatory | SPM package `AstroDesignTokens`. iOS has no existing DS library, so this package is the iOS design system foundation. |
| packages/web | Mandatory | npm package `@ghani-astro/design-tokens`, generated .mjs + .d.ts, token shape compatible with astro-fe-lib. |
| .github/workflows | Mandatory | PR validation (schema + regeneration check) and release (generate, version bump, tag, publish all three packages). |
| Platform catalogs | Optional | Phase 3. Living documentation and visual regression baseline. |

## Dependencies

| Dependency | Purpose |
| --- | --- |
| GitHub Actions | CI for validation and release. GITHUB_TOKEN only, no extra secrets. |
| GitHub Packages (Maven + npm) | Registry for the AAR and the npm package. Consumers authenticate with a read:packages token. |
| Git tags | SPM version resolution for iOS. |
| Node.js (CI only) | Runs the generators. Zero runtime dependencies. |
| JDK + Gradle (CI only) | Builds the AAR. |
| VPS (later) | Serves the Backbone editor as a static site. |
| GitHub fine-grained PAT | Used by the editor Sync feature to open PRs. Stored in browser localStorage in phase 1, moves to a small backend when hosted on the VPS. |

## What changes for each platform

| Platform | Change |
| --- | --- |
| Android (astro-buyer-android) | Adds GitHub Packages Maven repo + `com.astro.design:tokens` dependency on branch `cross-platform-design-system` (off master). Existing `com.astro.shop:design-system` stays; generated tokens can later replace its hand-written AstroColors/AstroDimens/AstroTypography. |
| iOS (astro-buyer-ios) | Adds SPM dependency on this repo on branch `cross-platform-design-system` (off main), via xcodegen/packages.yml since the project is XcodeGen-generated. Existing UniverseUI module keeps working; the generated package can later replace its local tokens.json. |
| Web (astro-mobile-web) | Adds `@ghani-astro/design-tokens` on branch `cross-platform-design-system` (off production). Token shape mirrors `@astronautsid/wpe-astro-ui/tokens` so a swap is low-diff. |
| Design | Edits happen in the Backbone editor. Every change becomes a reviewable PR. No more hand re-entry per platform. |

## Reference

- Related TRD (reference only, subject to change): Astro Design System - Technical Requirements Document (Confluence page 2175434801).
- Template ticket: TECH-138 [NEW SERVICE+REPO] [astro-pricing-engine-be] PROPOSAL.
