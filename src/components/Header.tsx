import { Expand, LockKeyhole, MonitorPlay } from 'lucide-react';

type Props = {
  familyName: string;
  tvMode: boolean;
  onTvMode: () => void;
  onLock: () => void;
};

export function Header({ familyName, tvMode, onTvMode, onLock }: Props) {
  async function fullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  return (
    <header className="app-header">
      <button className="wordmark" onClick={() => { window.location.hash = ''; }} aria-label="Zpět na rodinnou osu">
        <span className="wordmark-mark">B</span>
        <span>{familyName}</span>
      </button>
      <nav aria-label="Nástroje kroniky">
        <button className={tvMode ? 'tool active' : 'tool'} onClick={onTvMode} title="TV režim">
          <MonitorPlay size={18} /><span>TV</span>
        </button>
        <button className="tool fullscreen-tool" onClick={fullscreen} title="Celá obrazovka">
          <Expand size={18} /><span>Celá obrazovka</span>
        </button>
        <button className="tool" onClick={onLock} title="Zamknout kroniku">
          <LockKeyhole size={18} /><span>Zamknout</span>
        </button>
      </nav>
    </header>
  );
}
