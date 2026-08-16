import { useCallback, useEffect, useState } from 'react';
import type { ArchiveManifest } from './archive/types';
import { forgetKey } from './archive/key-store';
import { UnlockScreen } from './components/UnlockScreen';
import { Header } from './components/Header';
import { Timeline } from './components/Timeline';
import { StoryReader } from './components/StoryReader';

export default function App() {
  const [archive, setArchive] = useState<ArchiveManifest>();
  const [archiveKey, setArchiveKey] = useState<CryptoKey>();
  const [storyId, setStoryId] = useState(() => window.location.hash.replace('#story/', ''));
  const [tvMode, setTvMode] = useState(() => window.matchMedia('(min-width: 1400px)').matches);

  useEffect(() => {
    function hashChange() { setStoryId(window.location.hash.replace('#story/', '')); }
    window.addEventListener('hashchange', hashChange);
    return () => window.removeEventListener('hashchange', hashChange);
  }, []);

  const unlock = useCallback((nextArchive: ArchiveManifest, nextKey: CryptoKey) => {
    setArchive(nextArchive);
    setArchiveKey(nextKey);
  }, []);

  async function lock() {
    await forgetKey();
    setArchive(undefined);
    setArchiveKey(undefined);
    window.location.hash = '';
  }

  if (!archive || !archiveKey) return <UnlockScreen onUnlock={unlock} />;

  const story = archive.stories.find((item) => item.id === storyId);
  return (
    <div className={tvMode ? 'app tv-mode' : 'app'}>
      {!story && <Header familyName={archive.familyName} tvMode={tvMode} onTvMode={() => setTvMode((value) => !value)} onLock={lock} />}
      {story ? (
        <StoryReader story={story} archive={archive} archiveKey={archiveKey} tvMode={tvMode} onBack={() => { window.location.hash = ''; }} />
      ) : (
        <Timeline introduction={archive.introduction} stories={archive.stories} onOpen={(id) => { window.location.hash = `story/${id}`; }} />
      )}
    </div>
  );
}
