import { describe, expect, it, vi } from 'vitest';
import { getAdapter } from '@/export/adapters/registry';
import { type ExportDeps, buildSizeZip } from '@/export/pipeline';
import { createComponent, createProject, createSize } from '@/model/factories';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { runChecks } from '@/validation/rules';
import { defaultProps, resolveProps } from '../settings';
import { leadIssues, leadform } from './index';

const ctx = { id: 'x', sel: '#x', width: 280, height: 320 };
const GOOD = { endpoint: 'https://api.example.com/leads', privacyUrl: 'https://privacy.example.com/policy' };
const deps: ExportDeps = { loadAsset: async () => undefined, webpToPng: async (b) => b };

describe('lead form settings and checks', () => {
  it('needs an HTTPS endpoint, a privacy link and consent text; always warns about data collection', () => {
    expect(leadIssues(defaultProps(leadform)).map((i) => `${i.level}:${i.ruleId}`).sort())
      .toEqual(['error:lead-form-endpoint', 'error:lead-form-privacy', 'warning:lead-form']);
    expect(leadIssues(resolveProps(leadform, { ...GOOD, endpoint: 'http://api.example.com' })).map((i) => i.ruleId))
      .toContain('lead-form-endpoint');
    expect(leadIssues(resolveProps(leadform, { ...GOOD, consentText: ' ' })).map((i) => i.ruleId)).toContain('lead-form-consent');
    expect(leadIssues(resolveProps(leadform, GOOD)))
      .toEqual([expect.objectContaining({ ruleId: 'lead-form', level: 'warning', detail: 'Sends to api.example.com' })]);
  });

  it('always renders the consent checkbox and privacy link; phone only when switched on', () => {
    const html = leadform.render(resolveProps(leadform, GOOD), {}, ctx).html;
    expect(html).toContain('name="lf_consent"');
    expect(html).toContain('href="https://privacy.example.com/policy" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain('lf_phone');
    expect(leadform.render(resolveProps(leadform, { showPhone: true }), {}, ctx).html).toContain('name="lf_phone"');
    expect(leadform.render(defaultProps(leadform), {}, ctx).html).not.toContain('href=');
  });

  it('never stores data in the banner', () => {
    expect(leadform.runtime).not.toMatch(/localStorage|sessionStorage|cookie|indexedDB/);
  });

  it.each(['adform', 'cm360', 'dv360', 'ttd'] as const)('%s: exports with only the data warning once configured', async (id) => {
    const size = createSize(480, 480, { elements: [createComponent({ componentType: 'leadform', width: 280, height: 320, props: GOOD })] });
    const p = createProject('L', { platform: id, sizes: [size], landingUrl: 'https://www.example.com' });
    const r = await buildSizeZip(p, size.id, deps);
    const rs = runChecks({ project: p, size, adapter: getAdapter(id), manifest: r.manifest });
    expect(rs.filter((x) => x.level === 'error')).toEqual([]);
    expect(rs.filter((x) => x.level === 'warning').map((x) => x.ruleId)).toEqual(['lead-form']);
  });
});

// ── Runtime against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
const tick = () => new Promise((r) => setTimeout(r, 5));

function mountForm(values: { name?: string; email?: string; consent?: boolean }, preview: boolean) {
  const btnLs: Record<string, Fn> = {};
  const err = { textContent: '' };
  const btn = { disabled: false, addEventListener: (t: string, f: Fn) => { btnLs[t] = f; }, removeEventListener: () => {} };
  const add = vi.fn();
  const reset = vi.fn();
  const form = {
    elements: {
      lf_name: { value: values.name ?? '' }, lf_email: { value: values.email ?? '' }, lf_consent: { checked: values.consent ?? false },
    } as Record<string, unknown>,
    classList: { add },
    reset,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: (s: string) => (s === '.bc-lf-err' ? err : s === '.bc-lf-btn' ? btn : null),
  };
  const props = resolveProps(leadform, GOOD);
  const node = {
    getAttribute: (n: string) => (n === 'data-component' ? 'leadform' : n === 'data-props' ? JSON.stringify(props) : null),
    querySelector: (s: string) => (s === 'form' ? form : null),
  };
  const fetch = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true, status: 200 }));
  const bannr = { exit: vi.fn(), track: vi.fn(), preview };
  const win = { bannr, fetch, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [node] };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, leadform.runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  return { err, add, reset, fetch, bannr, submit: () => btnLs.click?.({ preventDefault: () => {} }) };
}

describe('lead form runtime', () => {
  it('rejects an invalid email and missing consent without sending anything', async () => {
    const a = mountForm({ name: 'Mira', email: 'nope', consent: true }, false);
    await tick();
    a.submit();
    expect(a.err.textContent).toBe('Please enter a valid email address.');
    const b = mountForm({ name: 'Mira', email: 'mira@example.com', consent: false }, false);
    await tick();
    b.submit();
    expect(b.err.textContent).toBe('Please agree to continue.');
    expect(a.fetch).not.toHaveBeenCalled();
    expect(b.fetch).not.toHaveBeenCalled();
  });

  it('in Preview, simulates a successful send without the network', async () => {
    const m = mountForm({ name: 'Mira', email: 'mira@example.com', consent: true }, true);
    await tick();
    m.submit();
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.add).toHaveBeenCalledWith('bc-lf-sent');
    expect(m.bannr.track).toHaveBeenCalledWith('lead_submitted');
  });

  it('live, posts JSON without cookies to the endpoint, then clears the form', async () => {
    const m = mountForm({ name: 'Mira', email: 'mira@example.com', consent: true }, false);
    await tick();
    m.submit();
    const [url, init] = m.fetch.mock.calls[0] as [string, { method: string; credentials: string; body: string }];
    expect(url).toBe(GOOD.endpoint);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' });
    expect(JSON.parse(init.body)).toEqual({
      name: 'Mira', email: 'mira@example.com', consent: true, consentText: String(defaultProps(leadform).consentText),
    });
    await tick();
    expect(m.reset).toHaveBeenCalled();
    expect(m.bannr.track).toHaveBeenCalledWith('lead_submitted');
  });
});
