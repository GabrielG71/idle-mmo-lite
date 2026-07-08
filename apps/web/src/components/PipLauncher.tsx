import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PipCanvas } from './PipCanvas';
import { useCharacterTicker } from '@/lib/useCharacterTicker';

/** Document Picture-in-Picture API (Chrome/Edge) — ainda não em lib.dom.d.ts. */
declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options: { width: number; height: number }): Promise<Window>;
    };
  }
}

type Mode = 'closed' | 'floating' | 'pip';

const PIP_SUPPORTED = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

export function PipLauncher({ characterId, classId }: { characterId: string; classId: number }) {
  const [mode, setMode] = useState<Mode>('closed');
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const ticker = useCharacterTicker(characterId, mode !== 'closed');

  async function open() {
    if (PIP_SUPPORTED) {
      try {
        const win = await window.documentPictureInPicture!.requestWindow({
          width: 320,
          height: 180,
        });
        const style = win.document.createElement('style');
        style.textContent = `
          body { margin: 0; background: #0a0a0f; display: flex; align-items: center;
                 justify-content: center; height: 100vh; }
        `;
        win.document.head.append(style);
        win.addEventListener('pagehide', () => {
          setMode('closed');
          setPipWindow(null);
        });
        setPipWindow(win);
        setMode('pip');
        return;
      } catch {
        // usuário cancelou o prompt do navegador ou a API falhou — cai pro fallback
      }
    }
    setMode('floating');
  }

  function close() {
    pipWindow?.close();
    setPipWindow(null);
    setMode('closed');
  }

  const canvas = <PipCanvas state={ticker} classId={classId} />;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={mode === 'closed' ? open : close}
      >
        <PictureInPicture2 size={14} />
        {mode === 'closed' ? 'Mini-player' : 'Fechar mini-player'}
      </Button>

      {mode === 'pip' && pipWindow && createPortal(canvas, pipWindow.document.body)}

      {mode === 'floating' && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-border bg-card/95 p-3 shadow-xl">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {PIP_SUPPORTED ? 'Mini-player' : 'PiP não suportado neste navegador'}
            </span>
            <button onClick={close} className="text-muted hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          {canvas}
        </div>
      )}
    </>
  );
}
