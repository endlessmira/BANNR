import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOUNT_JS, RUNTIME_JS } from '@/runtime/runtime';
import { cardswipe, placeCard } from './cardswipe';
import { panorama } from './panorama';
import { listComponents } from './registry';
import { defaultProps, missingSlots, resolveProps, resolveSlots, schemaIssues } from './settings';

const ctx = { id: 'x', sel: '#x', width: 300, height: 250 };
const imgs = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: 'image' as const, assetId: `a${i}` }));
const count = (html: string, s: string) => html.split(s).length - 1;

describe('card swipe render', () => {
  it('is registered, needs two cards and stacks them', () => {
    expect(listComponents().map((d) => d.type)).toEqual(expect.arrayContaining(['cardswipe', 'panorama']));
    expect(schemaIssues(cardswipe)).toEqual([]);
    expect(missingSlots(cardswipe, { cards: imgs(1) })).toEqual(['Cards']);
    const html = cardswipe.render(defaultProps(cardswipe), resolveSlots(cardswipe, { cards: imgs(3) }, (id) => `images/${id}.png`), ctx).html;
    expect(count(html, 'data-c="')).toBe(3);
    expect(count(html, 'data-vote="')).toBe(2);
    expect(count(html, 'data-cta="')).toBe(1);
    expect(html).toContain('style="transform:translateY(0%) scale(1);opacity:1;z-index:100"');
    expect(html).toContain('src="images/a2.png"');
    expect(placeCard(1)).toEqual({ t: 'translateY(4%) scale(0.95)', op: 1, z: 99 });
    expect(placeCard(3).op).toBe(0);
  });

  it('labels, no buttons, and a backup with only the first card', () => {
    const p = resolveProps(cardswipe, { likeLabel: 'JA', showButtons: false, endCta: '' });
    const html = cardswipe.render(p, {}, ctx).html;
    expect(html).toContain('<span class="bsw-st bsw-like">JA</span>');
    expect(count(html, 'data-vote="')).toBe(0);
    expect(count(html, 'data-cta="')).toBe(0);
    const backup = cardswipe.backupState(defaultProps(cardswipe), {}, ctx).html;
    expect(count(backup, 'data-c="')).toBe(1);
    expect(backup).not.toContain('bsw-end');
  });
});

describe('panorama render', () => {
  it('one image is a wide panorama; several images form a strip', () => {
    expect(schemaIssues(panorama)).toEqual([]);
    expect(missingSlots(panorama, {})).toEqual(['Images (one wide image, or several products)']);
    const one = panorama.render(defaultProps(panorama), resolveSlots(panorama, { images: imgs(1) }, (id) => id), ctx).html;
    expect(one).toContain('class="bpn-wide"');
    expect(count(one, 'data-p="')).toBe(0);
    const three = resolveSlots(panorama, { images: imgs(3) }, (id) => id);
    const left = panorama.render(defaultProps(panorama), three, ctx).html;
    expect(count(left, 'data-p="')).toBe(3);
    expect(left).toContain('transform:translateX(0px)');
    expect(panorama.render(resolveProps(panorama, { startAt: 'center' }), three, ctx).html).toContain('transform:translateX(-38px)');
    expect(count(panorama.render(defaultProps(panorama), {}, ctx).html, 'data-p="')).toBe(5);
  });

  it('has arrows with the carousel styling, but no dots', () => {
    const out = panorama.render(defaultProps(panorama), {}, ctx);
    expect(count(out.html, 'data-nav="')).toBe(2);
    expect(count(out.html, 'class="bpn-fade')).toBe(2);
    expect(out.css).toContain('#x .bpn-nav{width:28px');
    expect(out.css).not.toContain('bpn-dot');
    expect(Object.keys(panorama.settingsSchema).some((k) => k.startsWith('dot'))).toBe(false);
  });
});

// ── Runtimes against a minimal fake window/document ──
type Fn = (...a: unknown[]) => unknown;
function host(type: string, props: object, query: (s: string) => unknown) {
  const ls: Record<string, Fn[]> = {};
  const el = {
    style: {} as Record<string, string>,
    offsetWidth: 300,
    getAttribute: (k: string) => (k === 'data-component' ? type : k === 'data-props' ? JSON.stringify(props) : null),
    querySelector: query,
    addEventListener: (t: string, f: Fn) => { (ls[t] ??= []).push(f); },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    fire: (t: string, e: object) => { for (const f of ls[t] ?? []) f(e); },
  };
  return el;
}
function run(el: unknown, runtime: string) {
  const bannr = { exit: vi.fn(), track: vi.fn() };
  const win = { bannr, matchMedia: () => ({ matches: false }), requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, addEventListener: () => {} };
  const doc = { hidden: false, readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [el] };
  (new Function('window', 'document', 'bannr', [RUNTIME_JS, runtime, MOUNT_JS].join('\n')) as Fn)(win, doc, bannr);
  vi.runAllTimers();
  return bannr;
}
const ev = (x: number, target: unknown) => ({ pointerId: 1, clientX: x, clientY: 0, target, cancelable: true, preventDefault: () => {} });
const plain = { closest: () => null };
const attr = (name: string, value: string) => ({ closest: () => ({ getAttribute: (k: string) => (k === name ? value : null) }) });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => { vi.useRealTimers(); });

describe('card swipe runtime', () => {
  it('a swipe left dislikes, the like button likes, the end screen CTA exits', () => {
    const stamp = () => ({ style: {} as Record<string, string> });
    const cards = Array.from({ length: 2 }, () => {
      const like = stamp();
      const nope = stamp();
      return { style: {} as Record<string, string>, like, nope, querySelector: (s: string) => (s === '.bsw-like' ? like : s === '.bsw-nope' ? nope : null) };
    });
    const end = { classList: { add: vi.fn() } };
    const root = { querySelectorAll: () => cards, querySelector: () => end, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {}, removeEventListener: () => {} };
    const el = host('cardswipe', resolveProps(cardswipe, { hint: false }), (s) => (s === '.bsw' ? root : null));
    const bannr = run(el, cardswipe.runtime);
    expect(el.style.touchAction).toBe('pan-y');

    el.fire('pointerdown', ev(200, plain)); el.fire('pointermove', ev(0, plain)); el.fire('pointerup', ev(0, plain));
    expect(cards[0]!.style.transform).toBe('translateX(-150%) rotate(-25deg)');
    expect(cards[0]!.nope.style.opacity).toBe('1');
    expect(cards[1]!.style.transform).toBe('translateY(0%) scale(1)');
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.track).toHaveBeenCalledWith('dislike');

    el.fire('pointerdown', ev(10, attr('data-vote', 'like'))); el.fire('pointerup', ev(10, attr('data-vote', 'like')));
    expect(bannr.track).toHaveBeenCalledWith('like');
    expect(end.classList.add).toHaveBeenCalledWith('bsw-show');
    expect(bannr.track).toHaveBeenCalledWith('swipe_complete');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10, attr('data-cta', '1'))); el.fire('pointerup', ev(10, attr('data-cta', '1')));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});

describe('panorama runtime', () => {
  it('a drag pans the strip, an arrow moves it on, a tap elsewhere exits', () => {
    const track = { style: {} as Record<string, string>, scrollWidth: 900, offsetWidth: 900, querySelectorAll: () => [] };
    const root = { getAttribute: () => 'left', classList: { add: () => {}, remove: () => {} }, addEventListener: () => {}, removeEventListener: () => {} };
    const el = host('panorama', resolveProps(panorama, { autoPan: false, hint: false }),
      (s) => (s === '.bpn' ? root : s === '.bpn-track' ? track : null));
    const bannr = run(el, panorama.runtime);
    expect(el.style.touchAction).toBe('pan-y');
    expect(track.style.transform).toBe('translateX(0px)');

    el.fire('pointerdown', ev(200, plain)); el.fire('pointermove', ev(0, plain)); el.fire('pointerup', ev(0, plain));
    expect(track.style.transform).toBe('translateX(-200px)');
    expect(bannr.track).toHaveBeenCalledWith('interaction_start');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10, attr('data-nav', 'next'))); el.fire('pointerup', ev(10, attr('data-nav', 'next')));
    expect(track.style.transform).toBe('translateX(-380px)');
    expect(bannr.exit).not.toHaveBeenCalled();

    el.fire('pointerdown', ev(10, plain)); el.fire('pointerup', ev(10, plain));
    expect(bannr.exit).toHaveBeenCalledTimes(1);
  });
});
