import { jsString } from './escape';

export const TEST_CLICK_MESSAGE = 'bannr:test-click';
export const TRACK_MESSAGE = 'bannr:track';
export const ANIM_MESSAGE = 'bannr:anim';
export interface TestClickMessage { type: typeof TEST_CLICK_MESSAGE; url: string; target: string }
export interface TrackMessage { type: typeof TRACK_MESSAGE; name: string }

export const isTestClickMessage = (d: unknown): d is TestClickMessage =>
  typeof d === 'object' && d !== null && (d as { type?: unknown }).type === TEST_CLICK_MESSAGE;
export const isTrackMessage = (d: unknown): d is TrackMessage =>
  typeof d === 'object' && d !== null && (d as { type?: unknown }).type === TRACK_MESSAGE;

// Closing script tags are written as <\/script> (the same string in JS), so this source is safe to embed in HTML.

/**
 * Preview-only script (never exported):
 * - replaces window.open, so bannr.exit() runs for real and the editor shows the URL;
 * - lets the editor pause and resume the CSS animations.
 */
export const PREVIEW_HEAD_SHIM =
  '<script>(function(){' +
  `window.open=function(u,t){parent.postMessage({type:${jsString(TEST_CLICK_MESSAGE)},url:String(u),target:String(t||'_blank')},'*');return null;};` +
  `window.addEventListener('message',function(e){var d=e.data;if(!d||d.type!==${jsString(ANIM_MESSAGE)}||!document.getAnimations)return;` +
  "document.getAnimations().forEach(function(a){if(d.action==='paused'){if(a.playState==='running')a.pause();}" +
  "else if(a.playState==='paused'){a.play();}});});" +
  '})();<\/script>';

/**
 * Preview definitions of bannr.exit() and bannr.track(). In Phase 5 the selected platform
 * adapter's code replaces exit(), so the preview runs exactly what will be exported.
 */
export function previewInjection(landingUrl: string): { head: string; bodyEnd: string } {
  return {
    head: PREVIEW_HEAD_SHIM,
    bodyEnd:
      `<script>bannr.exit=function(){window.open(${jsString(landingUrl)},'_blank');};` +
      `bannr.track=function(n){parent.postMessage({type:${jsString(TRACK_MESSAGE)},name:String(n)},'*');};<\/script>`,
  };
}
