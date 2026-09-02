import {API} from '@/js/msg-api';
import './themer.css';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const els = {
  shell: $('.atm8-shell'), host: $('#atm8-host'), enabled: $('#atm8-enabled'),
  count: $('#atm8-live-count'), swatch: $('#atm8-swatch'), accent: $('#atm8-accent'),
  link: $('#atm8-link'), font: $('#atm8-font'), fontOut: $('#atm8-font-out'),
  radius: $('#atm8-radius'), radiusOut: $('#atm8-radius-out'),
  ruleCount: $('#atm8-rule-count'), ruleEmpty: $('#atm8-rule-empty'),
  ruleEditor: $('#atm8-rule-editor'), selector: $('#atm8-selector'),
  property: $('#atm8-property'), targetColor: $('#atm8-target-color'),
  targetRadius: $('#atm8-target-radius'), removeRule: $('#atm8-remove-rule'),
  pick: $('#atm8-pick'), export: $('#atm8-export'), siteAccess: $('#atm8-site-access'),
  status: $('#atm8-status'),
  pricing: $('#atm8-pricing'), planBadge: $('#atm8-plan-badge'),
  planCopy: $('#atm8-plan-copy'), keyToggle: $('#atm8-key-toggle'),
  licenseForm: $('#atm8-license-form'), license: $('#atm8-license'),
  deactivate: $('#atm8-deactivate'),
};

let activeTab;
let state;
let profile;
let saveTimer;
let saveChain = Promise.resolve();
let hasSiteAccess = false;

async function refreshSiteAccess() {
  hasSiteAccess = await chrome.permissions.contains({origins: ['<all_urls>']});
  els.siteAccess.disabled = hasSiteAccess;
  els.siteAccess.textContent = hasSiteAccess ? 'Website access enabled' : 'Enable on websites';
}

function announce(message, error = false) {
  els.status.textContent = message;
  els.status.classList.toggle('atm8-error', error);
}

function activeTarget() {
  return profile.targets.at(-1);
}

function updateOutputs() {
  els.fontOut.value = `${els.font.value}px`;
  els.radiusOut.value = `${els.radius.value}px`;
  els.swatch.style.background = `linear-gradient(145deg, ${els.accent.value}, ${els.link.value})`;
}

function drawRule() {
  const target = activeTarget();
  els.ruleEmpty.hidden = !!target;
  els.ruleEditor.hidden = !target;
  els.ruleCount.textContent = profile.targets.length
    ? `${profile.targets.length} rule${profile.targets.length === 1 ? '' : 's'}` : 'No rule yet';
  if (!target) return;
  els.selector.textContent = target.selector;
  els.property.value = target.property;
  const isColor = target.property === 'background' || target.property === 'text';
  els.targetColor.hidden = !isColor;
  els.targetRadius.hidden = target.property !== 'radius';
  if (isColor) els.targetColor.value = target.value;
  if (target.property === 'radius') els.targetRadius.value = target.value;
}

function draw() {
  els.host.textContent = state.host || 'Open a website to begin';
  els.enabled.checked = profile.enabled;
  els.accent.value = profile.accent;
  els.link.value = profile.linkColor;
  els.font.value = profile.fontSize;
  els.radius.value = profile.radius;
  for (const button of $$('[data-comfort]')) {
    button.setAttribute('aria-pressed', String(profile.comfort[button.dataset.comfort]));
  }
  els.count.textContent = String(4 + Object.values(profile.comfort).filter(Boolean).length +
    profile.targets.length);
  const pro = state.plan === 'pro';
  els.planBadge.textContent = pro ? 'Pro' : 'Free';
  els.planBadge.classList.toggle('atm8-pro', pro);
  els.planCopy.textContent = pro
    ? 'Unlimited picked rules are active on this device.'
    : 'One picked rule included. Controls and export stay free.';
  els.deactivate.hidden = !state.hasKey;
  els.pricing.href = state.pricingUrl;
  drawRule();
  updateOutputs();
}

function collect() {
  profile.enabled = els.enabled.checked;
  profile.accent = els.accent.value;
  profile.linkColor = els.link.value;
  profile.fontSize = Number(els.font.value);
  profile.radius = Number(els.radius.value);
  const target = activeTarget();
  if (target) {
    target.property = els.property.value;
    target.value = target.property === 'radius' ? Number(els.targetRadius.value)
      : target.property === 'hide' ? true : els.targetColor.value;
  }
}

function queueSave(immediate = false) {
  clearTimeout(saveTimer);
  updateOutputs();
  collect();
  const run = () => {
    const snapshot = structuredClone(profile);
    saveChain = saveChain.then(async () => {
      profile = await API.themer.saveProfile(activeTab.id, activeTab.url, snapshot);
      drawRule();
      announce('Saved for this domain');
    }).catch(error => announce(error.message, true));
  };
  if (immediate) run(); else saveTimer = setTimeout(run, 90);
}

function updateRuleInput() {
  const property = els.property.value;
  els.targetColor.hidden = property !== 'background' && property !== 'text';
  els.targetRadius.hidden = property !== 'radius';
  queueSave(true);
}

async function load() {
  const tabs = await chrome.tabs.query({currentWindow: true});
  activeTab = tabs.find(tab => tab.active);
  if (!activeTab) throw new Error('No active tab');
  // When opened as a normal extension tab (QA or side panel), target the most recently
  // used website tab. A real browser-action popup already resolves the tab beneath it.
  if (activeTab.url?.startsWith('chrome-extension://')) {
    activeTab = tabs.filter(tab => /^https?:/.test(tab.url || ''))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || activeTab;
  }
  const requestUrl = activeTab.url?.startsWith('chrome-extension://')
    ? 'https://example.com/' : activeTab.url;
  state = await API.themer.getState(activeTab.id, requestUrl);
  profile = state.profile;
  if (requestUrl !== activeTab.url) activeTab = {...activeTab, url: requestUrl};
  draw();
  els.shell.setAttribute('aria-busy', 'false');
}

for (const input of $$('[data-profile]')) input.addEventListener('input', () => queueSave());
els.enabled.addEventListener('change', () => queueSave(true));
for (const button of $$('[data-comfort]')) {
  button.addEventListener('click', () => {
    const key = button.dataset.comfort;
    profile.comfort[key] = !profile.comfort[key];
    button.setAttribute('aria-pressed', String(profile.comfort[key]));
    queueSave(true);
  });
}
els.property.addEventListener('change', updateRuleInput);
els.targetColor.addEventListener('input', () => queueSave());
els.targetRadius.addEventListener('input', () => queueSave());
els.removeRule.addEventListener('click', () => {
  profile.targets.pop();
  drawRule();
  queueSave(true);
});
els.pick.addEventListener('click', async () => {
  try {
    const result = await API.themer.startPicker(activeTab.id, activeTab.url);
    if (!result.ok && result.reason === 'rule-limit') {
      els.licenseForm.hidden = false;
      els.keyToggle.setAttribute('aria-expanded', 'true');
      announce('Pro unlocks additional picked rules. Your first rule stays editable.', true);
      return;
    }
    announce('Picker armed — click an element on the page');
    window.close();
  } catch (error) {
    announce(error.message || 'The picker cannot run on this page', true);
  }
});
els.export.addEventListener('click', async () => {
  try {
    const text = await API.themer.exportUserCss(activeTab.url);
    const blobUrl = URL.createObjectURL(new Blob([text], {type: 'text/css'}));
    const anchor = Object.assign(document.createElement('a'), {
      href: blobUrl, download: `${state.host || 'site'}-visual-theme.user.css`,
    });
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    announce('Portable .user.css downloaded');
  } catch (error) {
    announce(error.message, true);
  }
});
els.siteAccess.addEventListener('click', async () => {
  try {
    els.siteAccess.disabled = true;
    announce('Choose Allow to enable themes on websites');
    hasSiteAccess = await chrome.permissions.request({origins: ['<all_urls>']});
    await refreshSiteAccess();
    announce(hasSiteAccess
      ? 'Website access enabled — your saved themes now apply automatically'
      : 'Website access was not enabled', !hasSiteAccess);
  } catch (error) {
    announce(error.message || 'Website access could not be enabled', true);
  }
});
els.keyToggle.addEventListener('click', () => {
  const open = els.licenseForm.hidden;
  els.licenseForm.hidden = !open;
  els.keyToggle.setAttribute('aria-expanded', String(open));
  if (open) els.license.focus();
});
els.licenseForm.addEventListener('submit', async event => {
  event.preventDefault();
  announce('Checking key…');
  const result = await API.themer.activateLicense(els.license.value);
  if (result.valid === true) {
    state.plan = 'pro'; state.hasKey = true; draw();
    announce(result.offline ? 'Pro restored from offline cache' : 'Pro activated');
  } else {
    announce(result.error === 'bad-key-shape'
      ? 'Use the full 24-character key format' : 'That key could not be activated', true);
  }
});
els.deactivate.addEventListener('click', async () => {
  await API.themer.deactivateLicense();
  state.plan = 'free'; state.hasKey = false; els.license.value = ''; draw();
  announce('License removed from this device');
});

Promise.all([load(), refreshSiteAccess()]).catch(error => {
  els.shell.setAttribute('aria-busy', 'false');
  announce(error.message || 'Open a website to begin', true);
});
