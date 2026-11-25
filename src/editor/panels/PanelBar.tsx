import { useEffect, useRef, useState } from 'react';
import { collapseSections, expandAllSections, setSectionQuery } from './fields';

/** Sticky bar at the top of the properties panel: find a setting ( / ), expand or collapse every section. */
export function PanelBar() {
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const set = (v: string) => { setText(v); setSectionQuery(v); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); setSectionQuery(''); };
  }, []);

  return (
    <div className="rp-bar">
      <input
        ref={ref}
        className="ti rp-search"
        type="search"
        aria-label="Find a setting"
        placeholder="Find a setting…  ( / )"
        value={text}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { set(''); e.currentTarget.blur(); } }}
      />
      <button type="button" className="mini" title="Open every section" onClick={() => expandAllSections()}>Expand all</button>
      <button
        type="button"
        className="mini"
        title="Close every section"
        onClick={() => collapseSections(Array.from(document.querySelectorAll('.panel-right .psec')).map((e) => e.getAttribute('data-title') ?? ''))}
      >
        Collapse all
      </button>
    </div>
  );
}
