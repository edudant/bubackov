import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { loadBootstrap, unlockArchive, unlockWithKey } from '../archive/load';
import { forgetKey, loadRememberedKey, rememberKey } from '../archive/key-store';
import { validatePassphrase } from '../archive/crypto';
import type { ArchiveManifest, Bootstrap } from '../archive/types';

type Props = {
  onUnlock: (archive: ArchiveManifest, key: CryptoKey) => void;
};

export function UnlockScreen({ onUnlock }: Props) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextBootstrap = await loadBootstrap();
        if (!active) return;
        setBootstrap(nextBootstrap);
        const saved = await loadRememberedKey();
        if (saved && active) {
          try {
            onUnlock(await unlockWithKey(saved, nextBootstrap), saved);
            return;
          } catch {
            await forgetKey();
          }
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Kroniku se nepodařilo načíst.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [onUnlock]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!bootstrap) return;
    const validation = validatePassphrase(passphrase);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await unlockArchive(passphrase, bootstrap);
      if (remember) await rememberKey(result.key);
      onUnlock(result.archive, result.key);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kroniku se nepodařilo odemknout.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="unlock-screen">
      <div className="film-grain" aria-hidden="true" />
      <section className="unlock-card" aria-labelledby="unlock-title">
        <div className="crest"><span>B</span></div>
        <p className="kicker">Rodinná kronika</p>
        <h1 id="unlock-title">Bubackov</h1>
        <p className="unlock-lead">Příběhy, které patří rodině. Všechno se odemyká pouze ve vašem zařízení.</p>

        <form onSubmit={submit}>
          <label htmlFor="passphrase">Rodinná přístupová fráze</label>
          <div className="passphrase-field">
            <KeyRound size={19} aria-hidden="true" />
            <input
              id="passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="čtyři nebo více slov"
              disabled={loading || !bootstrap}
            />
            <button type="button" className="icon-button" onClick={() => setShow((value) => !value)} aria-label={show ? 'Skrýt frázi' : 'Zobrazit frázi'}>
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <label className="remember-row">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            <span>Pamatovat na tomto zařízení</span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={loading || !bootstrap}>
            {loading ? <><LoaderCircle className="spin" size={18} /> Načítám…</> : 'Odemknout kroniku'}
          </button>
        </form>

        <p className="privacy-note"><ShieldCheck size={16} /> Fráze se neposílá na internet. Slouží k lokálnímu rozšifrování.</p>
      </section>
    </main>
  );
}
