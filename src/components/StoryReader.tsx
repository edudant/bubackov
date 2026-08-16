import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Info, Pause, Play, Quote, X } from 'lucide-react';
import type { ArchiveManifest, ArchiveMedia, ArchiveStory } from '../archive/types';
import { loadMediaUrl } from '../archive/load';

type Props = {
  story: ArchiveStory;
  archive: ArchiveManifest;
  archiveKey: CryptoKey;
  tvMode: boolean;
  onBack: () => void;
};

function useMedia(media: ArchiveMedia | undefined, key: CryptoKey, width: number) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!media) return;
    let active = true;
    let objectUrl: string | undefined;
    void loadMediaUrl(media, key, width).then((next) => {
      objectUrl = next;
      if (active) setUrl(next);
      else URL.revokeObjectURL(next);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [media, key, width]);
  return url;
}

function GalleryImage({ media, archiveKey }: { media: ArchiveMedia; archiveKey: CryptoKey }) {
  const url = useMedia(media, archiveKey, 1100);
  if (!url) return <div className="gallery-placeholder" aria-label="Fotografie se načítá" />;
  return (
    <figure className="gallery-item">
      <img src={url} alt={media.alt} />
      <figcaption>
        <span>{media.caption}</span>
        {media.kind === 'external' && <span>{media.credit} · {media.license}</span>}
        {media.sourceUrl && <a href={media.sourceUrl} target="_blank" rel="noreferrer">Zdroj <ExternalLink size={12} /></a>}
      </figcaption>
    </figure>
  );
}

export function StoryReader({ story, archive, archiveKey, tvMode, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState(false);
  const [playing, setPlaying] = useState(tvMode);
  const scroller = useRef<HTMLDivElement>(null);
  const chapter = story.chapters[index];
  const media = useMemo(() => archive.media.find((item) => item.id === chapter?.mediaId), [archive.media, chapter?.mediaId]);
  const chapterMedia = useMemo(() => {
    if (!chapter) return [];
    const ids = [...new Set([chapter.mediaId, ...chapter.mediaIds].filter(Boolean))];
    return ids.map((id) => archive.media.find((item) => item.id === id)).filter((item): item is ArchiveMedia => Boolean(item));
  }, [archive.media, chapter]);
  const mediaUrl = useMedia(media, archiveKey, tvMode ? 2200 : 1200);

  const goTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(story.chapters.length - 1, next));
    setIndex(clamped);
    setDetails(false);
    scroller.current?.children[clamped]?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
  }, [story.chapters.length]);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goTo(index + 1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') goTo(index - 1);
      if (event.key === 'Escape') {
        if (details) setDetails(false);
        else onBack();
      }
      if (event.key === ' ') { event.preventDefault(); setPlaying((value) => !value); }
    }
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [details, goTo, index, onBack]);

  useEffect(() => {
    if (!tvMode || !playing || details) return;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % story.chapters.length;
        scroller.current?.children[next]?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
        return next;
      });
    }, 9000);
    return () => window.clearInterval(timer);
  }, [details, playing, story.chapters.length, tvMode]);

  function onScroll() {
    const node = scroller.current;
    if (!node) return;
    const next = Math.round(node.scrollLeft / node.clientWidth);
    if (next >= 0 && next < story.chapters.length) setIndex(next);
  }

  return (
    <main className={tvMode ? 'reader tv-reader' : 'reader'}>
      <div className="reader-toolbar">
        <button onClick={onBack}><ArrowLeft size={19} /> <span>Zpět na osu</span></button>
        <div className="chapter-progress" aria-label={`Kapitola ${index + 1} z ${story.chapters.length}`}>
          {story.chapters.map((item, itemIndex) => (
            <button key={item.id} className={itemIndex === index ? 'active' : ''} onClick={() => goTo(itemIndex)} aria-label={`Přejít na kapitolu ${itemIndex + 1}`} />
          ))}
        </div>
        {tvMode && <button onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={18} /> : <Play size={18} />}<span>{playing ? 'Pozastavit' : 'Přehrát'}</span></button>}
      </div>

      <div className="chapter-scroller" ref={scroller} onScroll={onScroll}>
        {story.chapters.map((item, itemIndex) => {
          const itemMedia = archive.media.find((candidate) => candidate.id === item.mediaId);
          const activeMediaUrl = itemIndex === index ? mediaUrl : undefined;
          return (
            <article className={`chapter tone-${item.tone}`} key={item.id} aria-hidden={itemIndex !== index}>
              {activeMediaUrl && itemMedia ? <img className="chapter-photo" src={activeMediaUrl} alt={itemMedia.alt} /> : <div className="chapter-landscape" aria-hidden="true"><span className="sun" /><span className="ridge ridge-one" /><span className="ridge ridge-two" /></div>}
              <div className="chapter-vignette" />
              <div className="chapter-copy">
                <p className="chapter-eyebrow">{item.eyebrow}</p>
                <h1>{item.title}</h1>
                <p className="chapter-summary">{item.summary}</p>
                <button className="detail-button" onClick={() => setDetails(true)} tabIndex={itemIndex === index ? 0 : -1}><Info size={17} /> Celý příběh</button>
              </div>
              {itemMedia?.caption && <p className="photo-caption">{itemMedia.caption}</p>}
              {item.mediaIds.length > 0 && <button className="gallery-count" onClick={() => setDetails(true)} aria-label={`Otevřít galerii, ${item.mediaIds.length + (item.mediaId ? 1 : 0)} fotografií`}>{item.mediaIds.length + (item.mediaId ? 1 : 0)} fotografií</button>}
            </article>
          );
        })}
      </div>

      <button className="reader-arrow previous" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Předchozí kapitola"><ChevronLeft /></button>
      <button className="reader-arrow next" onClick={() => goTo(index + 1)} disabled={index === story.chapters.length - 1} aria-label="Další kapitola"><ChevronRight /></button>

      {details && chapter && (
        <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(false); }}>
          <aside className="story-detail" role="dialog" aria-modal="true" aria-labelledby="detail-title">
            <button className="close-detail" onClick={() => setDetails(false)} aria-label="Zavřít detail"><X /></button>
            <p className="chapter-eyebrow">{chapter.eyebrow}</p>
            <h2 id="detail-title">{chapter.title}</h2>
            {chapter.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {chapterMedia.length > 0 && (
              <section className="chapter-gallery" aria-label={`Galerie kapitoly, ${chapterMedia.length} fotografií`}>
                <div className="gallery-heading"><span>Rodinné album</span><strong>{chapterMedia.length} fotografií</strong></div>
                {chapterMedia.map((item) => <GalleryImage key={item.id} media={item} archiveKey={archiveKey} />)}
              </section>
            )}
            {chapter.quotes.map((item) => (
              <blockquote key={`${item.speaker}-${item.text}`}><Quote size={22} /><p>{item.text}</p><footer>{item.speaker}</footer></blockquote>
            ))}
            {chapter.facts.map((fact) => (
              <section className="fact-card" key={fact.title}>
                <h3>{fact.title}</h3><p>{fact.text}</p>
                {fact.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.label} <ExternalLink size={13} /></a>)}
              </section>
            ))}
            {story.albumUrl && <a className="album-link" href={story.albumUrl} target="_blank" rel="noreferrer">Otevřít celé album v Google Photos <ExternalLink size={16} /></a>}
          </aside>
        </div>
      )}
    </main>
  );
}
