#!/usr/bin/env node
// Web token generator for the Astro cross-platform design system.
// Reads tokens/tokens.json and tokens/platform-names.json and emits the
// @ghani-astro/design-tokens npm package into packages/web/.
// Run from the repo root: node generators/web.mjs
// Plain Node.js, no npm dependencies.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tokens = JSON.parse(readFileSync(join(root, 'tokens', 'tokens.json'), 'utf8'))
const names = JSON.parse(readFileSync(join(root, 'tokens', 'platform-names.json'), 'utf8'))
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim()
const outDir = join(root, 'packages', 'web')
mkdirSync(outDir, { recursive: true })

// ---------------------------------------------------------------------------
// Token lookup and {reference} resolution
// ---------------------------------------------------------------------------

function tokenAt(path) {
  let node = tokens
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) {
      throw new Error(`Unknown token path: ${path}`)
    }
    node = node[part]
  }
  return node
}

function resolveValue(value, seen = new Set()) {
  if (typeof value === 'string') {
    const match = value.match(/^\{(.+)\}$/)
    if (match) {
      const ref = match[1]
      if (seen.has(ref)) throw new Error(`Circular token reference: ${ref}`)
      seen.add(ref)
      return resolveValue(tokenAt(ref).$value, seen)
    }
  }
  return value
}

function setNested(target, path, value) {
  let node = target
  for (let i = 0; i < path.length - 1; i++) {
    node = node[path[i]] ??= {}
  }
  node[path[path.length - 1]] = value
}

// ---------------------------------------------------------------------------
// Build the color object, mirroring astro-fe-lib color.ts grouping and keys
// ---------------------------------------------------------------------------

// Top-level group order as it appears in astro-fe-lib color.ts.
// gradient is intentionally absent: it is not part of tokens.json.
const GROUP_ORDER = [
  'galaxy',
  'nebula',
  'desktop',
  'tagging',
  'neutral',
  'sys',
  'btnPrimary',
  'btnSecondary',
  'bgColor',
  'textColor',
  'iconColor',
  'strokeColor',
  'qd',
  'btnNeutral',
]

// Scale groups sorted by shade number: color.ts lists these descending
// (galaxy-15 first) but the qd groups ascending (yl-1 first).
const DESC_SCALES = new Set(['galaxy', 'nebula', 'neutral', 'sys.green', 'sys.orange', 'sys.red'])
const ASC_SCALES = new Set(['qd.yellow', 'qd.cyan', 'qd.purple', 'qd.magenta'])

function shadeNumber(key) {
  const match = key.match(/(\d+)$/)
  return match ? Number(match[1]) : null
}

function orderScale(group, direction) {
  const keys = Object.keys(group)
  const numbered = keys
    .filter((k) => shadeNumber(k) !== null)
    .sort((a, b) => (direction === 'desc' ? shadeNumber(b) - shadeNumber(a) : shadeNumber(a) - shadeNumber(b)))
  const rest = keys.filter((k) => shadeNumber(k) === null)
  const out = {}
  for (const key of [...numbered, ...rest]) out[key] = group[key]
  return out
}

function buildColor() {
  const tree = {}
  for (const [tokenPath, platform] of Object.entries(names.color)) {
    if (platform.web === null || platform.web === undefined) continue
    const group = tokenPath.split('.')[1]
    // Dotted web names carry their own group path (sys.green.gr-8);
    // flat names (galaxy-8, special) live inside the token's own group.
    const path = platform.web.includes('.') ? platform.web.split('.') : [group, platform.web]
    setNested(tree, path, resolveValue(tokenAt(tokenPath).$value))
  }

  const ordered = {}
  const groups = [
    ...GROUP_ORDER.filter((g) => g in tree),
    ...Object.keys(tree).filter((g) => !GROUP_ORDER.includes(g)),
  ]
  for (const groupName of groups) {
    let group = tree[groupName]
    if (DESC_SCALES.has(groupName)) {
      group = orderScale(group, 'desc')
    } else if (Object.values(group).every((v) => typeof v === 'object')) {
      const sub = {}
      for (const [subName, subGroup] of Object.entries(group)) {
        const path = `${groupName}.${subName}`
        sub[subName] = DESC_SCALES.has(path)
          ? orderScale(subGroup, 'desc')
          : ASC_SCALES.has(path)
            ? orderScale(subGroup, 'asc')
            : subGroup
      }
      group = sub
    }
    ordered[groupName] = group
  }
  return ordered
}

const color = buildColor()

// ---------------------------------------------------------------------------
// Spacing and radii, mirroring spacing.ts / radii.ts (unitless px numbers)
// ---------------------------------------------------------------------------

function buildDimensionMap(section) {
  const out = {}
  for (const [tokenPath, platform] of Object.entries(section)) {
    if (platform.web === null || platform.web === undefined) continue
    out[platform.web] = parseInt(resolveValue(tokenAt(tokenPath).$value), 10)
  }
  return out
}

const spacesValue = buildDimensionMap(names.space)
const radii = buildDimensionMap(names.radius)

// ---------------------------------------------------------------------------
// Base text config and text variants, mirroring text.ts
// ---------------------------------------------------------------------------

function buildText() {
  const out = { fontFamily: resolveValue(tokens.font.family.sans.$value) }
  for (const [tokenPath, platform] of Object.entries(names.font)) {
    if (!tokenPath.startsWith('font.weight.')) continue
    if (platform.web === null || platform.web === undefined) continue
    out[platform.web] = resolveValue(tokenAt(tokenPath).$value)
  }
  // astro-fe-lib text.ts pins the base and html font size to 16;
  // both derive from font.size.md (16px).
  const base = parseInt(resolveValue(tokens.font.size.md.$value), 10)
  out.fontSize = base
  out.htmlFontSize = base
  return out
}

function buildTextVariant() {
  const out = {}
  for (const [tokenPath, platform] of Object.entries(names.text)) {
    if (platform.web === null || platform.web === undefined) continue
    const value = tokenAt(tokenPath).$value
    setNested(out, platform.web.split('.'), {
      fontFamily: resolveValue(value.fontFamily),
      fontWeight: resolveValue(value.fontWeight),
      lineHeight: resolveValue(value.lineHeight),
      fontSize: resolveValue(value.fontSize),
      letterSpacing: value.letterSpacing,
    })
  }
  return out
}

const text = buildText()
const textVariant = buildTextVariant()

// ---------------------------------------------------------------------------
// Emit index.mjs
// ---------------------------------------------------------------------------

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function jsString(s) {
  return s.includes("'") ? JSON.stringify(s) : `'${s}'`
}

function jsKey(k) {
  return IDENT_RE.test(k) ? k : `'${k}'`
}

function jsLiteral(value, indent = 0) {
  if (typeof value === 'string') return jsString(value)
  if (typeof value === 'number') return String(value)
  const pad = '  '.repeat(indent)
  const lines = Object.entries(value).map(
    ([k, v]) => `${pad}  ${jsKey(k)}: ${jsLiteral(v, indent + 1)},`,
  )
  return `{\n${lines.join('\n')}\n${pad}}`
}

const headerLines = [
  'GENERATED FILE - DO NOT EDIT.',
  `Built by generators/web.mjs from tokens/tokens.json (design tokens v${version}).`,
  'Regenerate with: node generators/web.mjs',
]
const jsHeader = headerLines.map((line) => `// ${line}`).join('\n') + '\n'
const cssHeader = `/*\n${headerLines.map((line) => ` * ${line}`).join('\n')}\n */\n`

const indexMjs = `${jsHeader}
export const color = ${jsLiteral(color)}

export const spacesValue = ${jsLiteral(spacesValue)}

export const radii = ${jsLiteral(radii)}

export const text = ${jsLiteral(text)}

export const textVariant = ${jsLiteral(textVariant)}
`

writeFileSync(join(outDir, 'index.mjs'), indexMjs)

// ---------------------------------------------------------------------------
// Emit index.d.ts
// ---------------------------------------------------------------------------

function isTextStyle(value) {
  return typeof value === 'object' && 'letterSpacing' in value && 'fontFamily' in value
}

function dtsType(value, indent = 0, useTextStyle = false) {
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (useTextStyle && isTextStyle(value)) return 'TextVariantStyle'
  const pad = '  '.repeat(indent)
  const lines = Object.entries(value).map(
    ([k, v]) => `${pad}  ${jsKey(k)}: ${dtsType(v, indent + 1, useTextStyle)}`,
  )
  return `{\n${lines.join('\n')}\n${pad}}`
}

const indexDts = `${jsHeader}
export declare const color: ${dtsType(color)}

export declare const spacesValue: ${dtsType(spacesValue)}

export declare const radii: ${dtsType(radii)}

export declare const text: ${dtsType(text)}

export interface TextVariantStyle {
  fontFamily: string
  fontWeight: number
  lineHeight: string
  fontSize: string
  letterSpacing: string
}

export declare const textVariant: ${dtsType(textVariant, 0, true)}
`

writeFileSync(join(outDir, 'index.d.ts'), indexDts)

// ---------------------------------------------------------------------------
// Emit tokens.css
// ---------------------------------------------------------------------------

function kebab(name) {
  return name
    .replace(/\./g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

const cssLines = []
for (const [tokenPath, platform] of Object.entries(names.color)) {
  if (platform.web === null || platform.web === undefined) continue
  const group = tokenPath.split('.')[1]
  const flat = platform.web.includes('.')
    ? platform.web
    : platform.web.startsWith(group)
      ? platform.web
      : `${group}-${platform.web}`
  cssLines.push(`  --color-${kebab(flat)}: ${resolveValue(tokenAt(tokenPath).$value)};`)
}
for (const [tokenPath, platform] of Object.entries(names.space)) {
  if (platform.web === null || platform.web === undefined) continue
  cssLines.push(`  --space-${kebab(platform.web)}: ${resolveValue(tokenAt(tokenPath).$value)};`)
}
for (const [tokenPath, platform] of Object.entries(names.radius)) {
  if (platform.web === null || platform.web === undefined) continue
  cssLines.push(`  --radius-${kebab(platform.web)}: ${resolveValue(tokenAt(tokenPath).$value)};`)
}

const tokensCss = `${cssHeader}:root {
${cssLines.join('\n')}
}
`

writeFileSync(join(outDir, 'tokens.css'), tokensCss)

// ---------------------------------------------------------------------------
// Emit package.json (version is kept in sync with the VERSION file)
// ---------------------------------------------------------------------------

const packageJson = {
  name: '@ghani-astro/design-tokens',
  version,
  description: 'Astro design tokens for web, generated from the cross-platform design system.',
  type: 'module',
  main: 'index.mjs',
  module: 'index.mjs',
  types: 'index.d.ts',
  exports: {
    '.': {
      types: './index.d.ts',
      import: './index.mjs',
      default: './index.mjs',
    },
    './tokens.css': './tokens.css',
  },
  files: ['index.mjs', 'index.d.ts', 'tokens.css', 'README.md'],
  sideEffects: false,
  repository: {
    type: 'git',
    url: 'https://github.com/ghani-astro/cross-platform-design-system.git',
  },
  publishConfig: {
    registry: 'https://npm.pkg.github.com/',
  },
}

writeFileSync(join(outDir, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n')

console.log(`Generated packages/web (v${version}): index.mjs, index.d.ts, tokens.css, package.json`)
