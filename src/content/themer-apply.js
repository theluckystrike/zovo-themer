/* Zovo Themer addition: applies persisted visual profiles on each matching page. */
const NS = 'atelier8d1';
const PROFILES_KEY = `${NS}.profiles.v1`;
const APPLY_PROFILE = `${NS}:apply-profile`;
const STYLE_ID = `${NS}-site-theme`;

function safeColor(value, fallback) {
  value = String(value || '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(value) ? value : fallback;
}

function clamp(value, min, max, fallback) {
  value = Number(value);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function makeCss(raw = {}) {
  if (raw.enabled === false) return '';
  const accent = safeColor(raw.accent, '#7657d6');
  const link = safeColor(raw.linkColor, '#3157b7');
  const size = clamp(raw.fontSize, 12, 24, 16);
  const radius = clamp(raw.radius, 0, 32, 10);
  const lines = [
    `:root{--${NS}-accent:${accent};--${NS}-font-size:${size}px;` +
      `--${NS}-radius:${radius}px;--${NS}-link:${link}}`,
    `html body{font-size:var(--${NS}-font-size)!important}`,
    `a:any-link{color:var(--${NS}-link)!important}`,
    `button,input,select,textarea,[role="button"]{` +
      `border-radius:var(--${NS}-radius)!important}`,
    `input[type="checkbox"],input[type="radio"],input[type="range"],progress{` +
      `accent-color:var(--${NS}-accent)!important}`,
    `:focus-visible{outline-color:var(--${NS}-accent)!important}`,
    `button,[role="button"],input[type="submit"]{` +
      `border-color:color-mix(in srgb,var(--${NS}-accent) 58%,currentColor)!important}`,
  ];
  if (raw.comfort?.contrast === true) {
    lines.push('html body{filter:contrast(1.12)!important}');
  }
  if (raw.comfort?.spacing === true) {
    lines.push('body :where(p,li,blockquote,article,main,td){line-height:1.75!important}');
  }
  if (raw.comfort?.systemFont === true) {
    lines.push('body,button,input,select,textarea{' +
      'font-family:system-ui,-apple-system,sans-serif!important}');
  }
  for (const item of Array.isArray(raw.targets) ? raw.targets.slice(0, 30) : []) {
    const selector = String(item?.selector || '').trim();
    if (!selector || selector.length > 320 || /[{};]/.test(selector)) continue;
    let declaration;
    if (item.property === 'text') {
      declaration = `color:${safeColor(item.value, accent)}!important`;
    } else if (item.property === 'radius') {
      declaration = `border-radius:${clamp(item.value, 0, 48, 10)}px!important`;
    } else if (item.property === 'hide') declaration = 'display:none!important';
    else declaration = `background-color:${safeColor(item.value, accent)}!important`;
    lines.push(`${selector}{${declaration}}`);
  }
  return lines.join('\n');
}

function apply(profile) {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    (document.documentElement || document).append(style);
  }
  style.textContent = makeCss(profile);
}

chrome.runtime.onMessage.addListener(message => {
  if (message?.data?.method === APPLY_PROFILE) apply(message.data.profile);
});

chrome.storage.local.get(PROFILES_KEY).then(data => {
  const profile = data[PROFILES_KEY]?.[location.hostname.toLowerCase()];
  if (profile) apply(profile);
});
