import { fontStack, rule, safeColor } from '@/renderer/css';
import { escapeHtml, escapeText } from '@/renderer/escape';
import type { ComponentDefinition, ComponentRenderCtx, ResolvedProps, SettingsSchema } from '../types';

/**
 * LEAD FORM: the only component that sends data out of the banner.
 * - The consent checkbox and the privacy link are always rendered (no setting removes them).
 * - Data goes ONLY to an https:// endpoint, as JSON via POST, without cookies.
 * - Nothing is stored in the banner; the form is cleared after sending.
 * - Preview / Interact simulates a successful send (bannr.preview), so no test data is posted.
 */
type Issue = { ruleId: string; level: 'error' | 'warning'; message: string; detail?: string };

export function httpsUrl(s: string): URL | null {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => String(v ?? '');

const SCHEMA: SettingsSchema = {
  title: { type: 'text', label: 'Form title', default: 'Get 10% off your first order', maxLength: 80 },
  showName: { type: 'toggle', label: 'Show name field', default: true },
  nameLabel: { type: 'text', label: 'Name label', default: 'Name', maxLength: 30 },
  requireName: { type: 'toggle', label: 'Name required', default: true },
  emailLabel: { type: 'text', label: 'Email label', default: 'Email', maxLength: 30, help: 'Email is always shown and always required.' },
  showPhone: { type: 'toggle', label: 'Show phone field', default: false },
  phoneLabel: { type: 'text', label: 'Phone label', default: 'Phone', maxLength: 30 },
  requirePhone: { type: 'toggle', label: 'Phone required', default: false },
  consentText: {
    type: 'text', label: 'Consent text', multiline: true, maxLength: 300,
    default: 'I agree to receive marketing emails and to the processing of my personal data.',
    help: 'Required. The consent checkbox can not be removed.',
  },
  privacyLabel: { type: 'text', label: 'Privacy link text', default: 'Privacy policy', maxLength: 40 },
  privacyUrl: { type: 'text', label: 'Privacy policy URL', default: '', help: 'Required, https:// only. Opens in a new tab.' },
  submitLabel: { type: 'text', label: 'Button label', default: 'Sign up', maxLength: 30 },
  endpoint: {
    type: 'text', label: 'Submit endpoint (HTTPS)', default: '',
    help: 'Required, https:// only. Data is sent as JSON with POST, without cookies, and never stored in the banner. The endpoint must allow cross-origin requests (CORS).',
  },
  successText: { type: 'text', label: 'Success message', default: 'Thank you! Check your inbox.', maxLength: 120 },
  ctaLabel: { type: 'text', label: 'Button after sending', default: 'Shop now', maxLength: 30, help: 'Opens the landing page. Leave empty to hide it.' },
  msgRequired: { type: 'text', label: 'Message: required fields', default: 'Please fill in the required fields.', maxLength: 120 },
  msgEmail: { type: 'text', label: 'Message: invalid email', default: 'Please enter a valid email address.', maxLength: 120 },
  msgConsent: { type: 'text', label: 'Message: consent missing', default: 'Please agree to continue.', maxLength: 120 },
  msgError: { type: 'text', label: 'Message: send failed', default: 'Something went wrong. Please try again.', maxLength: 120 },
  fontFamily: { type: 'font', label: 'Font', default: 'Arial' },
  textColor: { type: 'color', label: 'Text colour', default: '#111111' },
  bgColor: { type: 'color', label: 'Background', default: '#ffffff' },
  accentColor: { type: 'color', label: 'Button colour', default: '#f2a902' },
  buttonTextColor: { type: 'color', label: 'Button text colour', default: '#111111' },
};

/** Checklist issues: always a data-collection warning, plus errors for missing required settings. */
export function leadIssues(p: ResolvedProps): Issue[] {
  const ep = httpsUrl(str(p.endpoint));
  const out: Issue[] = [{
    ruleId: 'lead-form', level: 'warning',
    message: 'The Lead Form sends personal data out of the banner. Many ad platforms and publishers restrict data collection in ads, so confirm it is allowed before the campaign goes live.',
    ...(ep ? { detail: `Sends to ${ep.hostname}` } : {}),
  }];
  if (!ep) out.push({ ruleId: 'lead-form-endpoint', level: 'error', message: 'The Lead Form needs a submit endpoint URL starting with https://' });
  if (!httpsUrl(str(p.privacyUrl))) out.push({ ruleId: 'lead-form-privacy', level: 'error', message: 'The Lead Form needs a privacy policy link starting with https://' });
  if (!str(p.consentText).trim()) out.push({ ruleId: 'lead-form-consent', level: 'error', message: 'The Lead Form needs a consent text next to its checkbox' });
  return out;
}

function field(name: string, label: string, type: string, auto: string, required: boolean): string {
  return `<label class="bc-lf-f"><span>${escapeText(label)}${required ? '<b class="bc-lf-req"> *</b>' : ''}</span>` +
    `<input name="${name}" type="${type}" autocomplete="${auto}"${required ? ' required' : ''}></label>`;
}

function output(p: ResolvedProps, ctx: ComponentRenderCtx) {
  const privacy = httpsUrl(str(p.privacyUrl));
  const label = escapeText(str(p.privacyLabel));
  const link = privacy ? `<a href="${escapeHtml(privacy.href)}" target="_blank" rel="noopener noreferrer">${label}</a>` : `<a>${label}</a>`;
  const cta = str(p.ctaLabel).trim() ? `<button type="button" class="bc-lf-cta">${escapeText(str(p.ctaLabel))}</button>` : '';
  const title = str(p.title).trim() ? `<p class="bc-lf-t">${escapeText(str(p.title))}</p>` : '';
  const html =
    '<form class="bc-lf" novalidate><div class="bc-lf-body">' + title +
    (p.showName === true ? field('lf_name', str(p.nameLabel), 'text', 'name', p.requireName === true) : '') +
    field('lf_email', str(p.emailLabel), 'email', 'email', true) +
    (p.showPhone === true ? field('lf_phone', str(p.phoneLabel), 'tel', 'tel', p.requirePhone === true) : '') +
    `<label class="bc-lf-c"><input type="checkbox" name="lf_consent" required><span>${escapeText(str(p.consentText))}</span></label>` +
    `<p class="bc-lf-pl">${link}</p><p class="bc-lf-err" role="alert"></p>` +
    `<button type="button" class="bc-lf-btn">${escapeText(str(p.submitLabel))}</button></div>` +
    `<div class="bc-lf-ok"><p>${escapeText(str(p.successText))}</p>${cta}</div></form>`;
  const css = [
    rule(`${ctx.sel} .bc-lf`, {
      'font-family': fontStack(str(p.fontFamily)), color: safeColor(str(p.textColor), '#111'), background: safeColor(str(p.bgColor), '#fff'),
    }),
    rule(`${ctx.sel} .bc-lf-btn,${ctx.sel} .bc-lf-cta`, {
      background: safeColor(str(p.accentColor), '#f2a902'), color: safeColor(str(p.buttonTextColor), '#111'),
    }),
  ].join('\n');
  return { html, css };
}

// Submit is a click on a type="button" (and Enter in a field), not a form submit event:
// sandboxed ad iframes often block form submission entirely.
const RUNTIME = String.raw`bannr.define('leadform', function (el, p) {
  var f = el.querySelector('form');
  if (!f) return null;
  var err = f.querySelector('.bc-lf-err'), btn = f.querySelector('.bc-lf-btn'), cta = f.querySelector('.bc-lf-cta');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, started = false, busy = false;
  function field(n) { return f.elements[n] || null; }
  function val(n) { var i = field(n); return i ? String(i.value || '').trim() : ''; }
  function say(m) { if (err) err.textContent = m || ''; return false; }
  function start() { if (!started) { started = true; bannr.track('lead_form_start'); } }
  function sent() { f.reset(); f.classList.add('bc-lf-sent'); bannr.track('lead_submitted'); }
  function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (busy) return;
    say('');
    var d = {};
    if (field('lf_name')) { d.name = val('lf_name'); if (p.requireName && !d.name) return say(p.msgRequired); }
    d.email = val('lf_email');
    if (!EMAIL.test(d.email)) return say(p.msgEmail);
    if (field('lf_phone')) { d.phone = val('lf_phone'); if (p.requirePhone && !d.phone) return say(p.msgRequired); }
    var c = field('lf_consent');
    if (!c || !c.checked) return say(p.msgConsent);
    d.consent = true;
    d.consentText = String(p.consentText || '');
    if (bannr.preview) { sent(); return; }
    var url = String(p.endpoint || '');
    if (url.slice(0, 6) !== 'https:' || !window.fetch) { bannr.track('lead_error'); return say(p.msgError); }
    busy = true;
    if (btn) btn.disabled = true;
    window.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), credentials: 'omit', mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); sent(); })
      .catch(function () { say(p.msgError); bannr.track('lead_error'); })
      .then(function () { busy = false; if (btn) btn.disabled = false; d = null; });
  }
  function key(e) { var t = e.target; if (e.key === 'Enter' && t && t.tagName === 'INPUT' && t.type !== 'checkbox') submit(e); }
  function block(e) { e.preventDefault(); }
  function exit() { bannr.exit(); }
  if (btn) btn.addEventListener('click', submit);
  f.addEventListener('keydown', key);
  f.addEventListener('submit', block);
  f.addEventListener('focusin', start);
  if (cta) cta.addEventListener('click', exit);
  return { destroy: function () {
    if (btn) btn.removeEventListener('click', submit);
    f.removeEventListener('keydown', key);
    f.removeEventListener('submit', block);
    f.removeEventListener('focusin', start);
    if (cta) cta.removeEventListener('click', exit);
  } };
});`;

export const leadform: ComponentDefinition = {
  type: 'leadform',
  version: 1,
  label: 'Lead Form',
  category: 'widget',
  description: 'A sign-up form inside the banner. Sends data to your HTTPS endpoint.',
  icon: '✉',
  notice:
    'Collects personal data. Many ad platforms and publishers restrict this, so confirm it is allowed. ' +
    'A privacy policy link and an https:// endpoint are required before export.',
  defaultSize: { width: 280, height: 320 },
  minSize: { width: 200, height: 220 },
  recommendedSizes: ['480x480', '300x600', '320x480'],
  settingsSchema: SCHEMA,
  slots: [],
  capturesPointer: true,
  emits: ['lead_form_start', 'lead_submitted', 'lead_error'],
  weightBudgetKB: 6,
  styles:
    '.bc-lf{position:relative;width:100%;height:100%;overflow:auto;box-sizing:border-box;padding:12px;font-size:13px;line-height:1.3}' +
    '.bc-lf-body{display:flex;flex-direction:column;gap:8px}.bc-lf-t{margin:0;font-size:16px;font-weight:700}' +
    '.bc-lf-f{display:flex;flex-direction:column;gap:3px}' +
    '.bc-lf-f input{width:100%;box-sizing:border-box;padding:7px 8px;border:1px solid rgba(0,0,0,.25);border-radius:4px;font:inherit;background:#fff;color:#111}' +
    '.bc-lf-req{color:#c62828}.bc-lf-c{display:flex;gap:6px;align-items:flex-start;font-size:11px}.bc-lf-c input{flex:none;margin-top:2px}' +
    '.bc-lf-pl{margin:0;font-size:11px}.bc-lf a{color:inherit;text-decoration:underline}' +
    '.bc-lf-err{min-height:1em;margin:0;font-size:11px;color:#c62828}' +
    '.bc-lf-btn,.bc-lf-cta{padding:9px 12px;border:0;border-radius:4px;font:inherit;font-weight:700;cursor:pointer}.bc-lf-btn:disabled{opacity:.6}' +
    '.bc-lf-ok{display:none;height:100%;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}' +
    '.bc-lf-sent .bc-lf-body{display:none}.bc-lf-sent .bc-lf-ok{display:flex}',
  render: (p, _s, ctx) => output(p, ctx),
  runtime: RUNTIME,
  backupState: (p, _s, ctx) => output(p, ctx),
  validate: (p) => leadIssues(p),
  allowedHosts: (p) => {
    const u = httpsUrl(str(p.privacyUrl));
    return u ? [u.hostname.toLowerCase()] : [];
  },
};
