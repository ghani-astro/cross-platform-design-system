# Astro Cross-Platform Design System

One source of truth for Astro design tokens, consumed by Android, iOS, and Web.

## How it works

```
Backbone editor (editor/)  -->  Sync button  -->  PR to this repo
                                                      |
                                                   merge to main
                                                      |
                                              CI (GitHub Actions)
                                                      |
              +---------------------------------------+--------------------------------------+
              |                                       |                                      |
        AAR (Maven)                             SPM (git tag)                          npm (MJS)
  com.astro.design:tokens                    AstroDesignTokens                  @ghani-astro/design-tokens
              |                                       |                                      |
     astro-buyer-android                      astro-buyer-ios                       astro-mobile-web
```

- `tokens/tokens.json` is the canonical token source (DTCG format). Nothing else holds the truth.
- `editor/` is Backbone, the web token editor. Edit tokens, hit Sync, approve the diff, it opens a PR here.
- `generators/` turn tokens.json into Kotlin, Swift, and TypeScript constants that mirror the existing Astro naming on each platform.
- `packages/android` builds the AAR. `Sources/` + `Package.swift` is the Swift package. `packages/web` is the npm package.
- Merging a token PR regenerates everything, bumps the version, tags, and publishes all three packages.

## Layout

| Path | What |
|---|---|
| `tokens/tokens.json` | Source of truth (DTCG JSON) |
| `editor/` | Backbone editor web app (served on VPS) |
| `generators/` | Node codegen scripts (no dependencies) |
| `packages/android/` | Gradle project, publishes `com.astro.design:tokens` AAR |
| `Package.swift`, `Sources/` | SPM package `AstroDesignTokens` |
| `packages/web/` | npm package `@ghani-astro/design-tokens` |
| `.github/workflows/` | PR validation + release pipeline |

## Consuming

Android (`settings.gradle.kts` repo + dependency):

```kotlin
maven {
    url = uri("https://maven.pkg.github.com/ghani-astro/cross-platform-design-system")
    credentials { username = "<github-user>"; password = "<token with read:packages>" }
}
// build.gradle.kts
implementation("com.astro.design:tokens:<version>")
```

iOS (`Package.swift` or Xcode):

```swift
.package(url: "https://github.com/ghani-astro/cross-platform-design-system.git", from: "0.1.0")
```

Web (`.npmrc` + dependency):

```
@ghani-astro:registry=https://npm.pkg.github.com/
```

```bash
pnpm add @ghani-astro/design-tokens
```

## Token scope (current phase)

Colors, typography, spacing, radius. Light and dark values where the source defines them.
