/* ─────────────────────────────────────────────────────────────────────────────
 * Nova - Sync to GitHub
 *
 * Self-contained add-on loaded as a classic script AFTER the main inline
 * script in index.html. It reuses the app's globals (state, computeDiff,
 * generateTokensJson, workspaceMeta, openModal, closeModal, toast, render,
 * takeSnapshot, and the import pipeline) which live in the shared global
 * lexical environment of the page.
 *
 * Feature: review pending token changes, then push the current tokens.json
 * to a new branch on GitHub and open a pull request against the base branch.
 * Config (owner / repo / branch / PAT / file path) lives in localStorage.
 * ──────────────────────────────────────────────────────────────────────────── */
(() => {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const GH_LS_KEY = 'bb.github';
  const GH_API = 'https://api.github.com';
  const GH_DEFAULTS = {
    owner: 'ghani-astro',
    repo: 'cross-platform-design-system',
    baseBranch: 'main',
    pat: '',
    tokensPath: 'tokens/tokens.json',
  };

  function ghConfig() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(GH_LS_KEY)); } catch (e) { /* corrupt json */ }
    return Object.assign({}, GH_DEFAULTS, (stored && typeof stored === 'object') ? stored : {});
  }
  function ghSaveConfig(cfg) {
    try { localStorage.setItem(GH_LS_KEY, JSON.stringify(cfg)); } catch (e) { /* storage full */ }
  }
  function ghConfigComplete(cfg) {
    return !!(cfg.owner && cfg.repo && cfg.baseBranch && cfg.pat && cfg.tokensPath);
  }

  // ── Small helpers ─────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // UTF-8 safe base64 (btoa alone breaks on non-Latin1 characters)
  function b64EncodeUtf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function b64DecodeUtf8(b64) {
    const bin = atob(String(b64).replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function branchName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `tokens/sync-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  // GitHub REST call. Throws Error with the API message on non-2xx.
  async function ghApi(cfg, method, path, body) {
    const headers = {
      'Authorization': 'Bearer ' + cfg.pat,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(GH_API + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new Error('Network error: ' + (e && e.message ? e.message : 'request failed'));
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      let msg = (data && data.message) ? data.message : ('HTTP ' + res.status);
      if (data && Array.isArray(data.errors) && data.errors.length) {
        const extra = data.errors.map(er => er.message || er.code || '').filter(Boolean).join('; ');
        if (extra) msg += ' (' + extra + ')';
      }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Escape the URL path segments of the tokens file (keep the / separators)
  function encPath(p) {
    return String(p).split('/').map(encodeURIComponent).join('/');
  }

  // ── Diff rendering (mirrors openPreviewModal's markup and class names) ────
  const GROUP_TITLES = {
    'meta': 'Global settings',
    'categories': 'Categories',
    'palettes': 'Color · Primitives',
    'semantic': 'Color · Semantic tokens',
    'color-component-mapping': 'Color · Component mapping',
    'color-contrast': 'Color · Contrast pairs',
    'color-usage-rules': 'Color · Usage rules',
    'typography': 'Typography',
    'spacing': 'Spacing · Primitives',
    'spacing-semantic': 'Spacing · Semantic tokens',
    'spacing-component-mapping': 'Spacing · Component mapping',
    'spacing-layout-patterns': 'Spacing · Layout patterns',
    'spacing-usage-rules': 'Spacing · Usage rules',
    'sizing': 'Sizing · Legacy controls/containers',
    'sizing-scale': 'Sizing · Primitive scale',
    'sizing-semantic': 'Sizing · Semantic tokens',
    'sizing-component-mapping': 'Sizing · Component mapping',
    'sizing-usage-rules': 'Sizing · Usage rules',
    'radius': 'Radius · Primitive scale',
    'radius-semantic': 'Radius · Semantic tokens',
    'radius-component-mapping': 'Radius · Component mapping',
    'radius-usage-rules': 'Radius · Usage rules',
    'shadow': 'Shadow',
    'breakpoints': 'Breakpoints',
    'motion': 'Motion',
  };
  function groupTitle(key) {
    return GROUP_TITLES[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '));
  }
  function kindText(kind) {
    return kind === 'add' ? 'Added' : kind === 'rem' ? 'Removed' : 'Modified';
  }

  function renderDiffRow(d) {
    let detail = '';
    if (d.swatchBefore || d.swatchAfter) {
      detail = `<span class="detail">
        <span class="ba"><span class="sw" style="background:${esc(d.swatchBefore || 'transparent')}"></span>${esc(d.beforeText || '')}</span>
        <span class="arrow">→</span>
        <span class="ba"><span class="sw" style="background:${esc(d.swatchAfter || 'transparent')}"></span>${esc(d.afterText || '')}</span>
      </span>`;
    } else if (d.before !== undefined || d.after !== undefined) {
      detail = `<span class="detail">${esc(d.before ?? '')} <span class="arrow">→</span> ${esc(d.after ?? '')}</span>`;
    }
    const modePill = d.mode ? `<span class="mode-pill" data-mode="${esc(d.mode)}">${esc(String(d.mode).toUpperCase())}</span>` : '';
    return `
      <div class="diff-row">
        <span class="kind ${esc(d.kind)}">${kindText(d.kind)}</span>
        <span class="label">${esc(d.label)}</span>
        ${modePill}
        ${detail}
      </div>`;
  }

  function renderDiffList(diff) {
    if (!diff.length) {
      return `
        <div class="diff-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
          <div>No local changes since baseline</div>
          <div style="margin-top:6px; font-size:11.5px;">You can still sync: the repository may be behind the editor.</div>
        </div>`;
    }
    const keys = [];
    diff.forEach(d => { const k = d.group || 'meta'; if (!keys.includes(k)) keys.push(k); });
    return `<div class="diff-list">${keys.map(k => {
      const items = diff.filter(d => (d.group || 'meta') === k);
      return `
        <div class="diff-group">
          <div class="diff-group-h">${esc(groupTitle(k))} <span class="n">${items.length}</span></div>
          ${items.map(renderDiffRow).join('')}
        </div>`;
    }).join('')}</div>`;
  }

  // ── PR body (markdown) ────────────────────────────────────────────────────
  const PR_ROW_CAP = 100;
  function mdCell(v) {
    return String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  }
  function buildPrBody(diff, meta, cfg) {
    const lines = [];
    lines.push('## Token changes from Nova');
    lines.push('');
    lines.push(`Workspace: **${meta.name}** (\`${meta.slug}\`) · version ${meta.version}`);
    lines.push(`File: \`${cfg.tokensPath}\``);
    lines.push('');
    if (!diff.length) {
      lines.push('No local changes since the editor baseline were detected. This PR pushes the full current tokens.json to bring the repository up to date with the editor.');
    } else {
      lines.push(`${diff.length} change${diff.length === 1 ? '' : 's'}:`);
      lines.push('');
      lines.push('| Group | Change | Token | Before | After |');
      lines.push('| --- | --- | --- | --- | --- |');
      diff.slice(0, PR_ROW_CAP).forEach(d => {
        const before = d.beforeText !== undefined ? d.beforeText : (d.before ?? '');
        const after = d.afterText !== undefined ? d.afterText : (d.after ?? '');
        lines.push(`| ${mdCell(groupTitle(d.group || 'meta'))} | ${mdCell(kindText(d.kind))} | ${mdCell(d.label)} | ${mdCell(before)} | ${mdCell(after)} |`);
      });
      if (diff.length > PR_ROW_CAP) {
        lines.push('');
        lines.push(`...and ${diff.length - PR_ROW_CAP} more change${diff.length - PR_ROW_CAP === 1 ? '' : 's'} (list truncated at ${PR_ROW_CAP} rows).`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('Opened by Nova Sync');
    return lines.join('\n');
  }

  // ── Scoped styles for sync-specific bits (progress steps, links) ──────────
  function injectStyles() {
    if (document.getElementById('gh-sync-style')) return;
    const style = document.createElement('style');
    style.id = 'gh-sync-style';
    style.textContent = `
      .gh-target { display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; color:var(--text-secondary); background:var(--bg-sunken); border:1px solid var(--border-subtle); border-radius:6px; padding:8px 10px; margin:12px 0 0; }
      .gh-target .gh-target-repo { color:var(--text-primary); }
      .gh-steps { display:flex; flex-direction:column; gap:8px; margin:12px 0; }
      .gh-step { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:7px; font-size:12px; color:var(--text-tertiary); }
      .gh-step .gh-step-ic { width:18px; height:18px; flex:none; display:inline-flex; align-items:center; justify-content:center; }
      .gh-step .gh-step-ic svg { width:14px; height:14px; stroke:currentColor; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
      .gh-step.active { color:var(--text-primary); border-color:color-mix(in oklab, var(--accent) 40%, var(--border-default)); }
      .gh-step.done { color:var(--text-secondary); }
      .gh-step.done .gh-step-ic { color:var(--success); }
      .gh-step.error { color:var(--danger); border-color:color-mix(in oklab, var(--danger) 40%, var(--border-default)); }
      .gh-spinner { width:13px; height:13px; border-radius:50%; border:2px solid var(--border-default); border-top-color:var(--accent); animation:gh-spin .7s linear infinite; }
      @keyframes gh-spin { to { transform:rotate(360deg); } }
      .gh-error-box { margin-top:12px; padding:10px 12px; border:1px solid color-mix(in oklab, var(--danger) 40%, var(--border-default)); background:color-mix(in oklab, var(--danger) 8%, transparent); color:var(--danger); border-radius:7px; font-size:12px; font-family:var(--font-mono); word-break:break-word; }
      .gh-success { padding:26px 16px; text-align:center; }
      .gh-success svg { width:32px; height:32px; stroke:var(--success); fill:none; stroke-width:1.5; stroke-linecap:round; stroke-linejoin:round; margin-bottom:10px; }
      .gh-success .gh-success-title { font-size:14px; color:var(--text-primary); font-weight:600; margin-bottom:6px; }
      .gh-pr-link { display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-family:var(--font-mono); font-size:12px; color:var(--accent); text-decoration:none; border:1px solid color-mix(in oklab, var(--accent) 40%, var(--border-default)); border-radius:6px; padding:8px 12px; }
      .gh-pr-link:hover { background:color-mix(in oklab, var(--accent) 10%, transparent); }
      .gh-note { font-size:11.5px; color:var(--text-tertiary); line-height:1.5; margin:0 0 14px; }
      .gh-load-status { font-family:var(--font-mono); font-size:11px; color:var(--text-tertiary); margin-top:8px; word-break:break-word; }
      .gh-load-status.err { color:var(--danger); }
      .gh-load-status.ok { color:var(--success); }
    `;
    document.head.appendChild(style);
  }

  const GEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  const BRANCH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7"/><path d="M18 10.5c0 3-2.6 4.5-6 4.5H9.5"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  // ── Modal views ───────────────────────────────────────────────────────────
  // openModal is called ONCE per open; view switches replace #modal innerHTML
  // directly so we do not stack the modal's key handlers and observers.

  function modalEl() { return document.getElementById('modal'); }

  function openSyncModal() {
    injectStyles();
    const cfg = ghConfig();
    const modal = openModal('<div class="bb-modal-body"></div>');
    modal.classList.add('bb-modal-uni');
    if (ghConfigComplete(cfg)) showReviewView(modal);
    else showSettingsView(modal, { firstRun: true });
  }

  function showSettingsView(modal, opts) {
    opts = opts || {};
    const cfg = ghConfig();
    modal.classList.remove('bb-modal-wide');
    modal.innerHTML = `
      <div class="bb-modal-h">
        <h3 class="title">GitHub sync settings</h3>
        <span class="eyebrow">Sync · GitHub</span>
      </div>
      <div class="bb-modal-body">
        <p class="gh-note">
          The personal access token needs the classic <b>repo</b> scope, or a fine-grained
          token with <b>Contents: read and write</b> plus <b>Pull requests: read and write</b>
          on the target repository. It is stored only in this browser (localStorage).
        </p>
        <div class="field-row">
          <div class="field" style="flex:1;">
            <label class="field-label" for="gh-owner">Owner</label>
            <input class="input" id="gh-owner" type="text" autocomplete="off" spellcheck="false" value="${esc(cfg.owner)}" placeholder="${esc(GH_DEFAULTS.owner)}">
          </div>
          <div class="field" style="flex:1;">
            <label class="field-label" for="gh-repo">Repository</label>
            <input class="input" id="gh-repo" type="text" autocomplete="off" spellcheck="false" value="${esc(cfg.repo)}" placeholder="${esc(GH_DEFAULTS.repo)}">
          </div>
        </div>
        <div class="field-row">
          <div class="field" style="flex:1;">
            <label class="field-label" for="gh-base">Base branch</label>
            <input class="input" id="gh-base" type="text" autocomplete="off" spellcheck="false" value="${esc(cfg.baseBranch)}" placeholder="${esc(GH_DEFAULTS.baseBranch)}">
          </div>
          <div class="field" style="flex:1;">
            <label class="field-label" for="gh-path">Tokens file path</label>
            <input class="input" id="gh-path" type="text" autocomplete="off" spellcheck="false" value="${esc(cfg.tokensPath)}" placeholder="${esc(GH_DEFAULTS.tokensPath)}">
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="gh-pat">Personal access token</label>
          <input class="input" id="gh-pat" type="password" autocomplete="off" spellcheck="false" value="${esc(cfg.pat)}" placeholder="ghp_... or github_pat_...">
        </div>
        <div class="field">
          <label class="field-label">Repository tokens</label>
          <div class="field-row">
            <button class="ab-btn" type="button" id="gh-load-repo">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9M7 14l5 5 5-5M5 3h14"/></svg>
              Load from repo
            </button>
            <span style="font-size:11px; color:var(--text-tertiary);">Fetch ${esc(cfg.tokensPath)} from ${esc(cfg.baseBranch)} and import it as the new baseline.</span>
          </div>
          <div class="gh-load-status" id="gh-load-status" role="status"></div>
        </div>
      </div>
      <div class="bb-modal-foot">
        <span class="bb-foot-helper">Stored in localStorage key ${esc(GH_LS_KEY)}.</span>
        <div class="bb-foot-actions">
          <button class="ab-btn ab-btn-danger" type="button" id="gh-clear-pat">Clear token</button>
          <button class="ab-btn" type="button" id="gh-settings-cancel">Cancel</button>
          <button class="ab-btn ab-btn-pri" type="button" id="gh-settings-save">Save and continue</button>
        </div>
      </div>`;

    const readForm = () => ({
      owner: modal.querySelector('#gh-owner').value.trim() || GH_DEFAULTS.owner,
      repo: modal.querySelector('#gh-repo').value.trim() || GH_DEFAULTS.repo,
      baseBranch: modal.querySelector('#gh-base').value.trim() || GH_DEFAULTS.baseBranch,
      tokensPath: modal.querySelector('#gh-path').value.trim() || GH_DEFAULTS.tokensPath,
      pat: modal.querySelector('#gh-pat').value.trim(),
    });

    modal.querySelector('#gh-settings-save').addEventListener('click', () => {
      const next = readForm();
      ghSaveConfig(next);
      if (!ghConfigComplete(next)) {
        const status = modal.querySelector('#gh-load-status');
        status.className = 'gh-load-status err';
        status.textContent = 'A personal access token is required to sync.';
        return;
      }
      showReviewView(modal);
    });
    modal.querySelector('#gh-settings-cancel').addEventListener('click', () => {
      if (opts.firstRun) closeModal();
      else showReviewView(modal);
    });
    modal.querySelector('#gh-clear-pat').addEventListener('click', () => {
      const next = readForm();
      next.pat = '';
      ghSaveConfig(next);
      modal.querySelector('#gh-pat').value = '';
      const status = modal.querySelector('#gh-load-status');
      status.className = 'gh-load-status ok';
      status.textContent = 'Token cleared.';
    });
    modal.querySelector('#gh-load-repo').addEventListener('click', () => {
      const next = readForm();
      ghSaveConfig(next);
      loadFromRepo(next, modal.querySelector('#gh-load-status'));
    });
  }

  function showReviewView(modal) {
    const cfg = ghConfig();
    let diff = [];
    try { diff = computeDiff() || []; } catch (e) { diff = []; }
    modal.classList.add('bb-modal-wide');
    modal.innerHTML = `
      <div class="bb-modal-h">
        <h3 class="title">Sync to GitHub</h3>
        <span class="eyebrow">Sync · Review</span>
      </div>
      <div class="bb-modal-body">
        <div class="gh-target">
          ${BRANCH_SVG.replace('<svg ', '<svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none;" ')}
          <span class="gh-target-repo">${esc(cfg.owner)}/${esc(cfg.repo)}</span>
          <span>base ${esc(cfg.baseBranch)}</span>
          <span>·</span>
          <span>${esc(cfg.tokensPath)}</span>
        </div>
        ${renderDiffList(diff)}
      </div>
      <div class="bb-modal-foot">
        <span class="bb-foot-helper">${diff.length ? `${diff.length} pending change${diff.length === 1 ? '' : 's'} will be included in the PR summary.` : 'The full tokens.json will be committed as-is.'}</span>
        <div class="bb-foot-actions">
          <button class="ab-btn ab-btn-ghost" type="button" id="gh-open-settings" aria-label="GitHub sync settings">${GEAR_SVG} Settings</button>
          <button class="ab-btn" type="button" id="gh-cancel">Cancel</button>
          <button class="ab-btn ab-btn-pri" type="button" id="gh-approve">
            ${BRANCH_SVG}
            Approve and Create PR
          </button>
        </div>
      </div>`;

    modal.querySelector('#gh-cancel').addEventListener('click', closeModal);
    modal.querySelector('#gh-open-settings').addEventListener('click', () => showSettingsView(modal, { firstRun: false }));
    modal.querySelector('#gh-approve').addEventListener('click', () => runSync(modal, cfg, diff));
  }

  // ── Sync execution ────────────────────────────────────────────────────────
  const SYNC_STEPS = [
    { id: 'validate', label: 'Validating repository access' },
    { id: 'branch', label: 'Creating branch' },
    { id: 'commit', label: 'Committing tokens.json' },
    { id: 'pr', label: 'Opening pull request' },
  ];

  function showProgressView(modal, cfg) {
    modal.innerHTML = `
      <div class="bb-modal-h">
        <h3 class="title">Syncing to GitHub</h3>
        <span class="eyebrow">Sync · In progress</span>
      </div>
      <div class="bb-modal-body">
        <div class="gh-steps">
          ${SYNC_STEPS.map(s => `
            <div class="gh-step" data-step="${s.id}">
              <span class="gh-step-ic"></span>
              <span class="gh-step-label">${esc(s.label)}</span>
            </div>`).join('')}
        </div>
        <div id="gh-error-slot"></div>
      </div>
      <div class="bb-modal-foot">
        <span class="bb-foot-helper">Pushing to ${esc(cfg.owner)}/${esc(cfg.repo)}...</span>
        <div class="bb-foot-actions">
          <button class="ab-btn" type="button" id="gh-progress-close" disabled>Working...</button>
        </div>
      </div>`;
  }

  // All DOM updates are guarded: the user can close the modal mid-flight and
  // the fetch chain must not throw on missing nodes.
  function setStep(modal, id, phase, detail) {
    const row = modal.querySelector(`.gh-step[data-step="${id}"]`);
    if (!row) return;
    row.classList.remove('active', 'done', 'error');
    const ic = row.querySelector('.gh-step-ic');
    if (phase === 'active') { row.classList.add('active'); if (ic) ic.innerHTML = '<span class="gh-spinner"></span>'; }
    else if (phase === 'done') { row.classList.add('done'); if (ic) ic.innerHTML = CHECK_SVG; }
    else if (phase === 'error') { row.classList.add('error'); if (ic) ic.innerHTML = CROSS_SVG; }
    if (detail) {
      const label = row.querySelector('.gh-step-label');
      if (label) label.textContent = detail;
    }
  }

  function showSyncError(modal, stepId, err, cfg, diff) {
    setStep(modal, stepId, 'error');
    const slot = modal.querySelector('#gh-error-slot');
    if (slot) {
      slot.innerHTML = `<div class="gh-error-box">GitHub API: ${esc(err && err.message ? err.message : 'Unknown error')}</div>`;
    }
    const foot = modal.querySelector('.bb-modal-foot');
    if (foot) {
      foot.innerHTML = `
        <span class="bb-foot-helper">Nothing was merged. Fix the issue and retry.</span>
        <div class="bb-foot-actions">
          <button class="ab-btn ab-btn-ghost" type="button" id="gh-err-settings">${GEAR_SVG} Settings</button>
          <button class="ab-btn" type="button" id="gh-err-back">Back to review</button>
          <button class="ab-btn ab-btn-pri" type="button" id="gh-err-retry">Retry</button>
        </div>`;
      const back = foot.querySelector('#gh-err-back');
      if (back) back.addEventListener('click', () => showReviewView(modal));
      const settings = foot.querySelector('#gh-err-settings');
      if (settings) settings.addEventListener('click', () => showSettingsView(modal, { firstRun: false }));
      const retry = foot.querySelector('#gh-err-retry');
      if (retry) retry.addEventListener('click', () => runSync(modal, ghConfig(), diff));
    }
  }

  function showSuccessView(modal, pr, branch) {
    modal.innerHTML = `
      <div class="bb-modal-h">
        <h3 class="title">Pull request created</h3>
        <span class="eyebrow">Sync · Done</span>
      </div>
      <div class="bb-modal-body">
        <div class="gh-success">
          ${CHECK_SVG}
          <div class="gh-success-title">Tokens pushed to ${esc(branch)}</div>
          <div style="font-size:12px; color:var(--text-secondary);">Review and merge the pull request on GitHub.</div>
          <a class="gh-pr-link" href="${esc(pr.html_url)}" target="_blank" rel="noopener noreferrer">
            ${BRANCH_SVG.replace('<svg ', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" ')}
            ${esc(`#${pr.number} - ${pr.title || 'Open pull request'}`)}
          </a>
        </div>
      </div>
      <div class="bb-modal-foot">
        <span class="bb-foot-helper">${esc(pr.html_url)}</span>
        <div class="bb-foot-actions">
          <button class="ab-btn ab-btn-pri" type="button" id="gh-done">Done</button>
        </div>
      </div>`;
    const done = modal.querySelector('#gh-done');
    if (done) done.addEventListener('click', closeModal);
  }

  async function runSync(modal, cfg, diff) {
    showProgressView(modal, cfg);
    const repoBase = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
    const branch = branchName();
    const meta = (typeof workspaceMeta === 'function')
      ? workspaceMeta()
      : { name: 'Workspace', slug: 'workspace', version: '' };

    // 1. Validate access
    let stepId = 'validate';
    try {
      setStep(modal, stepId, 'active');
      await ghApi(cfg, 'GET', repoBase);
      setStep(modal, stepId, 'done');

      // 2. Base sha + create branch
      stepId = 'branch';
      setStep(modal, stepId, 'active');
      const ref = await ghApi(cfg, 'GET', `${repoBase}/git/ref/heads/${encodeURIComponent(cfg.baseBranch)}`);
      const baseSha = ref && ref.object && ref.object.sha;
      if (!baseSha) throw new Error(`Could not resolve sha for branch ${cfg.baseBranch}`);
      await ghApi(cfg, 'POST', `${repoBase}/git/refs`, { ref: 'refs/heads/' + branch, sha: baseSha });
      setStep(modal, stepId, 'done', `Created branch ${branch}`);

      // 3. Existing file sha (404 means the file is new), then commit
      stepId = 'commit';
      setStep(modal, stepId, 'active');
      let fileSha = null;
      try {
        const existing = await ghApi(cfg, 'GET', `${repoBase}/contents/${encPath(cfg.tokensPath)}?ref=${encodeURIComponent(cfg.baseBranch)}`);
        if (existing && existing.sha) fileSha = existing.sha;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      const json = generateTokensJson();
      const putBody = {
        message: `tokens: update from Nova (${meta.name})`,
        content: b64EncodeUtf8(json),
        branch,
      };
      if (fileSha) putBody.sha = fileSha;
      await ghApi(cfg, 'PUT', `${repoBase}/contents/${encPath(cfg.tokensPath)}`, putBody);
      setStep(modal, stepId, 'done', `Committed ${cfg.tokensPath}`);

      // 4. Open PR
      stepId = 'pr';
      setStep(modal, stepId, 'active');
      const pr = await ghApi(cfg, 'POST', `${repoBase}/pulls`, {
        title: `tokens: update from Nova (${meta.name})`,
        head: branch,
        base: cfg.baseBranch,
        body: buildPrBody(diff, meta, cfg),
      });
      setStep(modal, stepId, 'done');
      showSuccessView(modal, pr, branch);
      if (typeof toast === 'function') toast(`Pull request #${pr.number} opened`);
    } catch (err) {
      showSyncError(modal, stepId, err, cfg, diff);
    }
  }

  // ── Load from repo (best effort import via the existing pipeline) ─────────
  function setLoadStatus(el, cls, msg) {
    if (!el) return;
    el.className = 'gh-load-status' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }

  function downloadJsonFallback(text) {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokens.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function loadFromRepo(cfg, statusEl) {
    if (!ghConfigComplete(cfg)) {
      setLoadStatus(statusEl, 'err', 'Fill in owner, repo, branch, path, and token first.');
      return;
    }
    setLoadStatus(statusEl, '', `Fetching ${cfg.tokensPath} from ${cfg.baseBranch}...`);
    const repoBase = `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`;
    let text;
    try {
      const file = await ghApi(cfg, 'GET', `${repoBase}/contents/${encPath(cfg.tokensPath)}?ref=${encodeURIComponent(cfg.baseBranch)}`);
      if (file && file.content) {
        text = b64DecodeUtf8(file.content);
      } else if (file && file.download_url) {
        // Files over 1MB come back without inline content
        const raw = await fetch(file.download_url);
        if (!raw.ok) throw new Error('HTTP ' + raw.status + ' fetching raw file');
        text = await raw.text();
      } else {
        throw new Error('File content unavailable from the contents API');
      }
    } catch (err) {
      setLoadStatus(statusEl, 'err', 'Fetch failed: ' + (err && err.message ? err.message : 'unknown error'));
      return;
    }

    // Import through the app's own pipeline; degrade to a plain download if
    // the internals are missing or the file shape does not line up.
    try {
      const internalsOk =
        typeof parseDTCG === 'function' &&
        typeof computeImportDiff === 'function' &&
        typeof applyImportSelection === 'function' &&
        typeof takeSnapshot === 'function' &&
        typeof state === 'object' && state !== null;
      if (!internalsOk) throw new Error('import internals unavailable');

      const json = JSON.parse(text);
      const parsed = parseDTCG(json);
      if (!parsed || !parsed.ok || !parsed.data) throw new Error(parsed && parsed.error ? parsed.error : 'no DTCG tokens found');

      const importDiff = computeImportDiff(parsed.data);
      if (!importDiff || !Array.isArray(importDiff.groups)) throw new Error('unexpected import diff shape');

      const selections = {};
      importDiff.groups.forEach(g => (g.items || []).forEach(it => { selections[it.key] = true; }));
      const applied = applyImportSelection({ parsed: parsed.data, diff: importDiff, selections });

      // Reset the baseline to the just-loaded repo state
      state.baseline = takeSnapshot();
      if (typeof render === 'function') render();

      const n = applied && typeof applied.total === 'number' ? applied.total : 0;
      setLoadStatus(statusEl, 'ok', `Imported ${n} change${n === 1 ? '' : 's'} from the repo. Baseline reset.`);
      if (typeof toast === 'function') toast(`Loaded ${cfg.tokensPath} from ${cfg.owner}/${cfg.repo}`);
    } catch (err) {
      downloadJsonFallback(text);
      setLoadStatus(statusEl, 'err',
        `Automatic import failed (${err && err.message ? err.message : 'unknown error'}). ` +
        'Downloaded tokens.json instead; use the Import button in the header to bring it in.');
    }
  }

  // ── Header button injection ───────────────────────────────────────────────
  function injectSyncButton() {
    if (document.getElementById('btn-github-sync')) return;
    const exportBtn = document.getElementById('btn-export');
    if (!exportBtn) return; // header not present on this page
    const btn = document.createElement('button');
    btn.className = 'ab-btn';
    btn.id = 'btn-github-sync';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Sync tokens to GitHub');
    btn.innerHTML = `${BRANCH_SVG} Sync`;
    btn.addEventListener('click', openSyncModal);
    exportBtn.insertAdjacentElement('afterend', btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSyncButton);
  } else {
    injectSyncButton();
  }
})();
