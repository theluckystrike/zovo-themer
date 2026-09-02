/*
 * Zovo Themer additions to the upstream GPL-3.0 codebase.
 * Visual profiles remain local; only explicit licence activation calls the verifier.
 */
import {onMessage} from '@/js/msg';

const NS = 'atelier8d1';
const PROFILES_KEY = `${NS}.profiles.v1`;
const LICENSE_KEY = `${NS}.license`;
const LICENSE_CACHE_KEY = `${NS}.licenseCache`;
const PICK_RESULT = `${NS}:picker-result`;
const PICK_START = `${NS}:picker-start`;
const APPLY_PROFILE = `${NS}:apply-profile`;
const VERIFY_URL = 'https://zgubxqomnbmxgbdhvwja.supabase.co/functions/v1/verify-extension-license';
const PRICING_URL = 'https://zovo.one/pricing';
const KEY_PATTERN = /^ZOVO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const FREE_RULE_LIMIT = 1;

const DEFAULT_PROFILE = Object.freeze({
  enabled: true,
  accent: '#7657d6',
  fontSize: 16,
  radius: 10,
  linkColor: '#3157b7',
  comfort: {contrast: false, spacing: false, systemFont: false},
  targets: [],
});

function normalizeHost(raw) {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

function color(value, fallback) {
  value = String(value || '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback;
}

function number(value, min, max, fallback) {
  value = Number(value);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function cleanSelector(value) {
  value = String(value || '').trim();
  return value && value.length <= 320 && !/[{};]/.test(value) ? value : '';
}

function cleanTarget(raw, fallbackAccent) {
  const selector = cleanSelector(raw?.selector);
  const property = ['background', 'text', 'radius', 'hide'].includes(raw?.property)
    ? raw.property : 'background';
  if (!selector) return null;
  return {
    id: String(raw?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 48),
    selector,
    label: String(raw?.label || selector).replace(/\s+/g, ' ').slice(0, 52),
    property,
    value: property === 'radius'
      ? number(raw?.value, 0, 48, 10)
      : property === 'hide' ? true : color(raw?.value, fallbackAccent),
  };
}

function cleanProfile(raw = {}) {
  const accent = color(raw.accent, DEFAULT_PROFILE.accent);
  const profile = {
    enabled: raw.enabled !== false,
    accent,
    fontSize: number(raw.fontSize, 12, 24, DEFAULT_PROFILE.fontSize),
    radius: number(raw.radius, 0, 32, DEFAULT_PROFILE.radius),
    linkColor: color(raw.linkColor, DEFAULT_PROFILE.linkColor),
    comfort: {
      contrast: raw.comfort?.contrast === true,
      spacing: raw.comfort?.spacing === true,
      systemFont: raw.comfort?.systemFont === true,
    },
    targets: (Array.isArray(raw.targets) ? raw.targets : [])
      .slice(0, 30).map(item => cleanTarget(item, accent)).filter(Boolean),
  };
  return profile;
}

function targetDeclaration(target) {
  if (target.property === 'text') return `color:${target.value} !important;`;
  if (target.property === 'radius') return `border-radius:${target.value}px !important;`;
  if (target.property === 'hide') return 'display:none !important;';
  return `background-color:${target.value} !important;`;
}

export function profileToCss(raw) {
  const p = cleanProfile(raw);
  if (!p.enabled) return '';
  const lines = [
    ':root {',
    `  --${NS}-accent: ${p.accent};`,
    `  --${NS}-font-size: ${p.fontSize}px;`,
    `  --${NS}-radius: ${p.radius}px;`,
    `  --${NS}-link: ${p.linkColor};`,
    '}',
    `html body { font-size: var(--${NS}-font-size) !important; }`,
    `a:any-link { color: var(--${NS}-link) !important; }`,
    `button, input, select, textarea, [role="button"] { ` +
      `border-radius: var(--${NS}-radius) !important; }`,
    `input[type="checkbox"], input[type="radio"], input[type="range"], progress { ` +
      `accent-color: var(--${NS}-accent) !important; }`,
    `:focus-visible { outline-color: var(--${NS}-accent) !important; }`,
    `button, [role="button"], input[type="submit"] { ` +
      `border-color: color-mix(in srgb, var(--${NS}-accent) 58%, currentColor) !important; }`,
  ];
  if (p.comfort.contrast) {
    lines.push('html body { filter: contrast(1.12) !important; }');
  }
  if (p.comfort.spacing) {
    lines.push('body :where(p, li, blockquote, article, main, td) {' +
      ' line-height: 1.75 !important; }');
  }
  if (p.comfort.systemFont) {
    lines.push('body, button, input, select, textarea {' +
      ' font-family: system-ui, -apple-system, sans-serif !important; }');
  }
  for (const target of p.targets) {
    lines.push(`${target.selector} { ${targetDeclaration(target)} }`);
  }
  return lines.join('\n');
}

async function readState() {
  const data = await chrome.storage.local.get([PROFILES_KEY, LICENSE_KEY, LICENSE_CACHE_KEY]);
  return {
    profiles: data[PROFILES_KEY] && typeof data[PROFILES_KEY] === 'object'
      ? data[PROFILES_KEY] : {},
    license: typeof data[LICENSE_KEY] === 'string' ? data[LICENSE_KEY] : '',
    cache: data[LICENSE_CACHE_KEY],
  };
}

function expIsCurrent(exp, now) {
  if (!exp) return true;
  const millis = exp < 1e12 ? exp * 1000 : exp;
  return Number.isFinite(millis) && millis > now;
}

function cacheGrants(cache, now = Date.now()) {
  return cache?.valid === true && Number.isFinite(cache.checkedAt)
    && cache.checkedAt <= now + 60000
    && now - cache.checkedAt <= OFFLINE_GRACE_MS
    && expIsCurrent(cache.exp, now);
}

async function pushProfile(tabId, profile) {
  try {
    await chrome.tabs.sendMessage(tabId, {data: {method: APPLY_PROFILE, profile}});
  } catch {
    // Restricted and pre-navigation pages cannot host content scripts.
  }
}

async function profileFor(url) {
  const host = normalizeHost(url);
  const {profiles} = await readState();
  return {host, profile: cleanProfile(profiles[host])};
}

async function storeProfile(host, profile) {
  const state = await readState();
  state.profiles[host] = cleanProfile(profile);
  await chrome.storage.local.set({[PROFILES_KEY]: state.profiles});
  return state.profiles[host];
}

async function verifyLicense(raw) {
  const key = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!KEY_PATTERN.test(key)) return {valid: false, error: 'bad-key-shape'};
  const state = await readState();
  const offline = () => state.license === key && cacheGrants(state.cache)
    ? {valid: true, offline: true}
    : {valid: false, offline: true, error: 'offline-connect-to-activate'};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: __.SUPABASE_ANON_KEY,
        authorization: `Bearer ${__.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({license_key: key, extension: 'zovothemer'}),
      signal: controller.signal,
    });
    if (!response.ok) return {valid: false, error: `server-${response.status}`};
    const body = await response.json().catch(() => null);
    if (!body || typeof body.valid !== 'boolean') return {valid: false, error: 'bad-response'};
    if (body.valid === true) {
      const cache = {valid: true, checkedAt: Date.now(), exp: Number(body.exp) || 0};
      await chrome.storage.local.set({[LICENSE_KEY]: key, [LICENSE_CACHE_KEY]: cache});
      return {valid: true, exp: cache.exp};
    }
    await chrome.storage.local.remove(LICENSE_CACHE_KEY);
    return {valid: false, error: 'server-declined'};
  } catch {
    return offline();
  } finally {
    clearTimeout(timer);
  }
}

async function acceptPick(message, tab) {
  if (!tab?.id || !tab.url) return false;
  const host = normalizeHost(tab.url);
  if (!host) return false;
  const state = await readState();
  const profile = cleanProfile(state.profiles[host]);
  const pro = cacheGrants(state.cache);
  if (!pro && profile.targets.length >= FREE_RULE_LIMIT) return false;
  const selector = cleanSelector(message.selector);
  if (!selector) return false;
  const target = cleanTarget({
    selector,
    label: `${message.label || 'element'} rule`,
    property: 'background',
    value: profile.accent,
  }, profile.accent);
  profile.targets.push(target);
  const stored = await storeProfile(host, profile);
  await pushProfile(tab.id, stored);
  await chrome.action.setBadgeText({tabId: tab.id, text: '1'}).catch(() => {});
  await chrome.action.setBadgeBackgroundColor({tabId: tab.id, color: '#7657d6'}).catch(() => {});
  return true;
}

onMessage.set((message, sender) => {
  if (message.method === PICK_RESULT) return acceptPick(message, sender.tab);
}, true);

export const themerApi = {
  async getState(tabId, url) {
    const {host, profile} = await profileFor(url);
    const state = await readState();
    const pro = cacheGrants(state.cache);
    return {host, profile, plan: pro ? 'pro' : 'free', hasKey: !!state.license,
      pricingUrl: PRICING_URL, freeRuleLimit: FREE_RULE_LIMIT};
  },
  async saveProfile(tabId, url, raw) {
    const host = normalizeHost(url);
    if (!host || !Number.isInteger(tabId)) throw new Error('This page cannot be themed');
    const profile = await storeProfile(host, raw);
    await pushProfile(tabId, profile);
    return profile;
  },
  async startPicker(tabId, url) {
    const host = normalizeHost(url);
    if (!host || !Number.isInteger(tabId)) throw new Error('This page cannot be themed');
    const state = await readState();
    const profile = cleanProfile(state.profiles[host]);
    if (!cacheGrants(state.cache) && profile.targets.length >= FREE_RULE_LIMIT) {
      return {ok: false, reason: 'rule-limit'};
    }
    const armed = await chrome.tabs.sendMessage(tabId, {data: {method: PICK_START}});
    if (armed?.ok !== true) throw new Error('Enable website access, then reload this page');
    return {ok: true};
  },
  async activateLicense(key) {
    return verifyLicense(key);
  },
  async deactivateLicense() {
    await chrome.storage.local.remove([LICENSE_KEY, LICENSE_CACHE_KEY]);
    return {valid: false};
  },
  async exportUserCss(url) {
    const {host, profile} = await profileFor(url);
    if (!host) throw new Error('This page cannot be exported');
    const css = profileToCss(profile);
    const safeHost = host.replace(/[^a-z0-9.-]/gi, '');
    return [
      '/* ==UserStyle==',
      `@name           ${safeHost} visual theme`,
      '@namespace      atelier8d1.local',
      '@version        1.0.0',
      `@description    Exported visual controls for ${safeHost}`,
      '==/UserStyle== */',
      '',
      `@-moz-document domain("${safeHost}") {`,
      css.split('\n').map(line => `  ${line}`).join('\n'),
      '}',
      '',
    ].join('\n');
  },
};
