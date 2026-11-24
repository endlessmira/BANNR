import { type FormEvent, useState } from 'react';
import { PLATFORM_LABELS } from '@/model/platforms';
import type { PlatformId } from '@/model/types';

export interface NewProjectInput { name: string; platform: PlatformId }

const PLATFORM_IDS = Object.keys(PLATFORM_LABELS) as PlatformId[];

interface Props {
  onCreate: (input: NewProjectInput) => void;
  onCancel?: () => void;
}

export function NewProjectDialog({ onCreate, onCancel }: Props) {
  const [name, setName] = useState('Untitled banner');
  const [platform, setPlatform] = useState<PlatformId | null>(null); // nothing preselected
  const canCreate = platform !== null && name.trim() !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (platform && name.trim()) onCreate({ name: name.trim(), platform });
  };

  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={submit} aria-labelledby="np-title">
        <h1 id="np-title">New project</h1>

        <label className="field">
          <span>Project name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        <fieldset className="field">
          <legend>Ad platform <em>(required)</em></legend>
          <div className="platform-grid">
            {PLATFORM_IDS.map((id) => (
              <label key={id} className="platform-option" data-selected={platform === id}>
                <input type="radio" name="platform" value={id} checked={platform === id} onChange={() => setPlatform(id)} />
                {PLATFORM_LABELS[id]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="modal-actions">
          {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
          <button type="submit" className="primary" disabled={!canCreate}>
            {platform ? 'Create project' : 'Choose a platform to continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
