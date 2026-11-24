import { jsString } from './escape';

export const TEST_CLICK_MESSAGE = 'bannr:test-click';
export interface TestClickMessage { type: typeof TEST_CLICK_MESSAGE; url: string; target: string }

export const isTestClickMessage = (d: unknown): d is TestClickMessage =>
  typeof d === 'object' && d !== null && (d as { type?: unknown }).type === TEST_CLICK_MESSAGE;

/**
 * Replaces window.open inside the preview iframe. The real platform click code then runs
 * unchanged, and the editor shows the URL it would open instead of navigating away.
 */
export const PREVIEW_HEAD_SHIM =
  `<script>(function(){window.open=function(u,t){parent.postMessage({type:${jsString(TEST_CLICK_MESSAGE)},` +
  `url:String(u),target:String(t||'_blank')},'*');return null;};})();</script>`;

/** Phase 1 click wiring. In Phase 5 the selected adapter's code (plus an Adform dhtml stub) replaces bodyEnd. */
export function previewInjection(landingUrl: string): { head: string; bodyEnd: string } {
  return {
    head: PREVIEW_HEAD_SHIM,
    bodyEnd: `<script>clickArea.onclick=function(){window.open(${jsString(landingUrl)},'_blank');};</script>`,
  };
}
