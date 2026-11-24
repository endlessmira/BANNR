import { jsString } from './escape';

export const TEST_CLICK_MESSAGE = 'bannr:test-click';
export const ANIM_MESSAGE = 'bannr:anim';
export interface TestClickMessage { type: typeof TEST_CLICK_MESSAGE; url: string; target: string }

export const isTestClickMessage = (d: unknown): d is TestClickMessage =>
  typeof d === 'object' && d !== null && (d as { type?: unknown }).type === TEST_CLICK_MESSAGE;

// Closing script tags are written as <\/script> (the same string in JS), so this source is safe to embed in HTML.

/**
 * Preview-only script (never exported):
 * - replaces window.open, so the real platform click code runs and the editor shows the URL;
 * - lets the editor pause and resume the CSS animations.
 */
export const PREVIEW_HEAD_SHIM =
  '<script>(function(){' +
  `window.open=function(u,t){parent.postMessage({type:${jsString(TEST_CLICK_MESSAGE)},url:String(u),target:String(t||'_blank')},'*');return null;};` +
  `window.addEventListener('message',function(e){var d=e.data;if(!d||d.type!==${jsString(ANIM_MESSAGE)}||!document.getAnimations)return;` +
  "document.getAnimations().forEach(function(a){if(d.action==='paused'){if(a.playState==='running')a.pause();}" +
  "else if(a.playState==='paused'){a.play();}});});" +
  '})();<\/script>';

/** Phase 1 click wiring. In Phase 5 the selected adapter's code (plus an Adform dhtml stub) replaces bodyEnd. */
export function previewInjection(landingUrl: string): { head: string; bodyEnd: string } {
  return {
    head: PREVIEW_HEAD_SHIM,
    bodyEnd: `<script>clickArea.onclick=function(){window.open(${jsString(landingUrl)},'_blank');};<\/script>`,
  };
}
