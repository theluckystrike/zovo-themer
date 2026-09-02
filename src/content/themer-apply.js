/* Zovo Themer addition: applies persisted visual profiles on each matching page. */
const NS = 'atelier8d1';
const PROFILES_KEY = `${NS}.profiles.v1`;
const APPLY_PROFILE = `${NS}:apply-profile`;
const PICK_START = `${NS}:picker-start`;
const PICK_RESULT = `${NS}:picker-result`;
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

function armPicker() {
  const oldStop = globalThis[`${NS}PickerStop`];
  if (typeof oldStop === 'function') oldStop();
  const overlay = document.createElement('div');
  const note = document.createElement('div');
  const style = document.createElement('style');
  style.textContent = `
    [data-${NS}-overlay] { position:fixed; z-index:2147483646; pointer-events:none;
      border:2px solid #7657d6; background:rgba(118,87,214,.14); border-radius:5px;
      box-shadow:0 0 0 1px rgba(255,255,255,.8) inset; }
    [data-${NS}-note] { position:fixed; z-index:2147483647; left:50%; top:18px;
      transform:translateX(-50%); padding:10px 14px; border-radius:999px; color:white;
      background:#181529; font:600 13px/1.2 system-ui; box-shadow:0 8px 24px rgba(0,0,0,.3); }
  `;
  overlay.dataset[`${NS}Overlay`] = '';
  note.dataset[`${NS}Note`] = '';
  note.textContent = 'Click an element to create its rule · Esc to cancel';
  document.documentElement.append(style, overlay, note);

  const selectorFor = element => {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const path = [];
    for (let el = element;
      el && el.nodeType === 1 && el !== document.documentElement;
      el = el.parentElement) {
      let part = el.localName;
      const classes = [...el.classList].filter(x => x.length < 40).slice(0, 2);
      if (classes.length) part += classes.map(x => `.${CSS.escape(x)}`).join('');
      const parent = el.parentElement;
      if (parent) {
        const same = [...parent.children]
          .filter(child => child.localName === el.localName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
      }
      path.unshift(part);
      const candidate = path.join(' > ');
      try { if (document.querySelectorAll(candidate).length === 1) return candidate; } catch {}
      if (path.length === 5) break;
    }
    return path.join(' > ');
  };
  const move = event => {
    const el = event.target;
    if (!(el instanceof Element) || el === overlay || el === note) return;
    const rect = el.getBoundingClientRect();
    Object.assign(overlay.style, {
      left: `${rect.left}px`, top: `${rect.top}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
  };
  const stop = () => {
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('click', choose, true);
    document.removeEventListener('keydown', keydown, true);
    overlay.remove(); note.remove(); style.remove();
    delete globalThis[`${NS}PickerStop`];
  };
  const choose = event => {
    const el = event.target;
    if (!(el instanceof Element) || el === note) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const computed = getComputedStyle(el);
    const selector = selectorFor(el);
    stop();
    chrome.runtime.sendMessage({data: {
      method: PICK_RESULT, selector, label: el.localName,
      sample: {color: computed.color, backgroundColor: computed.backgroundColor},
    }}).catch(() => {});
  };
  const keydown = event => { if (event.key === 'Escape') stop(); };
  globalThis[`${NS}PickerStop`] = stop;
  document.addEventListener('pointermove', move, true);
  document.addEventListener('click', choose, true);
  document.addEventListener('keydown', keydown, true);
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.data?.method === PICK_START) {
    armPicker();
    sendResponse({ok: true});
    return;
  }
  if (message?.data?.method === APPLY_PROFILE) apply(message.data.profile);
});

chrome.storage.local.get(PROFILES_KEY).then(data => {
  const profile = data[PROFILES_KEY]?.[location.hostname.toLowerCase()];
  if (profile) apply(profile);
});
