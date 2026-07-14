# @ghani-astro/design-tokens

Astro design tokens for web, generated from the cross-platform design system
(`tokens/tokens.json`). The exported object shapes and key names mirror
`astro-fe-lib` (`@astro-ui` color, text, spacing and radii tokens) so this
package can be used as a drop-in source of truth.

Do not edit the files in this package by hand. Regenerate from the repo root:

```bash
node generators/web.mjs
```

## Install

```bash
npm install @ghani-astro/design-tokens
```

Published to GitHub Packages (`https://npm.pkg.github.com/`).

## Usage

```js
import { color, spacesValue, radii, text, textVariant } from '@ghani-astro/design-tokens'

color.galaxy['galaxy-8'] // '#246EE5'
color.sys.green['gr-8']  // '#00AA5B'
color.btnPrimary.hover   // '#194DA0'
spacesValue.lg           // 16
radii.sm                 // 8
text.fontWeightBold      // 700
textVariant.display.huge // { fontFamily, fontWeight, lineHeight, fontSize, letterSpacing }
```

CSS custom properties are also available:

```css
@import '@ghani-astro/design-tokens/tokens.css';

.card {
  background: var(--color-bg-color-light);
  border-radius: var(--radius-sm);
  padding: var(--space-lg);
  color: var(--color-galaxy-8);
}
```

## Exports

- `color`: nested color groups (`galaxy`, `nebula`, `desktop`, `tagging`,
  `neutral`, `sys`, `btnPrimary`, `btnSecondary`, `bgColor`, `textColor`,
  `iconColor`, `strokeColor`, `qd`, `btnNeutral`)
- `spacesValue`: spacing scale as unitless px numbers
- `radii`: border radius scale as unitless px numbers
- `text`: base font config (family, weights, base font size)
- `textVariant`: typography variants (`display`, `headline`, `body`,
  `paragraph`, `caption`)

## Differences from astro-fe-lib

- `color.gradient` is omitted: gradients are not part of `tokens.json` yet.
- `textVariant.caption.tinyStrong` is omitted: it has no web name in
  `tokens/platform-names.json` (Android only).
- `text.fontFamily` is the normalized value from `tokens.json`
  (`'Nunito Sans', sans-serif`); astro-fe-lib carries a stray trailing
  semicolon inside the string.
- Legacy key quirks from astro-fe-lib are preserved on purpose, for example
  `sys.red` mixing `rd-1`..`rd-10` with `red-11`..`red-15`, `qd.purple`
  mixing `pr-*` with `pu-11`..`pu-15`, and `qd.magenta.pr-7`.
