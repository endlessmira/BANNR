import { getAdapter } from '@/export/adapters/registry';
import type { Project, Size } from '@/model/types';
import { jsString } from './escape';

export const TEST_CLICK_MESSAGE = 'bannr:test-click';
export const TRACK_MESSAGE = 'bannr:track';
export const ANIM_MESSAGE = 'bannr:anim';
export const TIME_MESSAGE = 'bannr:time';
export interface TestClickMessage { type: typeof TEST_CLICK_MESSAGE; url: string; target: string }
export interface TrackMessage { type: typeof TRACK_MESSAGE; name: string }
export interface TimeMessage { type: typeof TIME_MESSAGE; ms: number }

const isMsg = (d: unknown, type: string): boolean =>
  typeof d === 'object' && d !== null && (d as { type?: unknown }).type === type;
export const isTestClickMessage = (d: unknown): d is TestClickMessage => isMsg(d, TEST_CLICK_MESSAGE);
export const isTrackMessage = (d: unknown): d is TrackMessage => isMsg(d, TRACK_MESSAGE);
export const isTimeMessage = (d: unknown): d is TimeMessage =>
  isMsg(d, TIME_MESSAGE) && typeof (d as { ms?: unknown }).ms === 'number';

// Closing script tags are written as <\/script> (the same string in JS), so this source is safe to embed in HTML.

/**
 * Preview-only script (never exported):
 * - replaces window.open, so bannr.exit() runs for real and the editor shows the URL;
 * - lets the editor pause, resume and seek the CSS animations;
 * - reports the current animation time so the timeline playhead can follow it.
 */
export const PREVIEW_HEAD_SHIM =
  '<script>(function(){window.bannr=window.bannr||{};window.bannr.preview=true;' +
  `window.open=function(u,t){parent.postMessage({type:${jsString(TEST_CLICK_MESSAGE)},url:String(u),target:String(t||'_blank')},'*');return null;};` +
  'var anims=function(){return document.getAnimations?document.getAnimations():[];};' +
  `window.addEventListener('message',function(e){var d=e.data;if(!d||d.type!==${jsString(ANIM_MESSAGE)})return;` +
  "anims().forEach(function(a){if(d.action==='seek'){a.pause();a.currentTime=Number(d.ms)||0;}" +
  "else if(d.action==='paused'){if(a.playState==='running')a.pause();}" +
  "else if(a.playState==='paused'){a.play();}});});" +
  'var last=-100;function tick(){var as=anims();if(as.length){var t=Number(as[0].currentTime)||0;' +
  `if(Math.abs(t-last)>=33){last=t;parent.postMessage({type:${jsString(TIME_MESSAGE)},ms:t},'*');}}requestAnimationFrame(tick);}` +
  'requestAnimationFrame(tick);' +
  "document.addEventListener('keydown',function(e){var t=e.target,n=t&&t.tagName;" +
  "if(e.code!=='Space'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||(t&&t.isContentEditable)||n==='INPUT'||n==='TEXTAREA'||n==='SELECT')return;" +
  "e.preventDefault();parent.postMessage({type:'bannr:space'},'*');});" +
  '})();<\/script>';

/**
 * Preview injection: the selected platform's REAL head and click code (the same strings the export uses),
 * plus preview-only globals (e.g. an Adform dhtml stub, so nothing loads from the network) and a
 * bannr.track() that reports events to the editor.
 */
export function previewInjection(project: Project, size: Size): { head: string; bodyEnd: string } {
  const a = getAdapter(project.selectedPlatform);
  return {
    head: [PREVIEW_HEAD_SHIM, a.previewGlobals ? `<script>${a.previewGlobals}<\/script>` : '', a.injectHead(size, project)]
      .filter(Boolean)
      .join('\n'),
    bodyEnd: [
      a.injectClickScript(project),
      `<script>bannr.track=function(n){parent.postMessage({type:${jsString(TRACK_MESSAGE)},name:String(n)},'*');};<\/script>`,
    ].join('\n'),
  };
}
