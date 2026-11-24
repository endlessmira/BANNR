import logoUrl from '@/assets/bannr-logo.svg';
import { PLATFORM_LABELS } from '@/model/platforms';
import type { PlatformId } from '@/model/types';

export function Header({ projectName, platform }: { projectName: string; platform: PlatformId }) {
  return (
    <header className="app-header">
      <img src={logoUrl} alt="BANNR" className="app-logo" />
      <span className="app-project">{projectName}</span>
      <span className="platform-badge" title="Target ad platform">{PLATFORM_LABELS[platform]}</span>
    </header>
  );
}
