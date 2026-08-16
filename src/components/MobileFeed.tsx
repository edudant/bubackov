import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, BookOpen, ExternalLink, Images, LockKeyhole, MapPin, Quote as QuoteIcon, X } from 'lucide-react';
import type { ArchiveManifest, ArchiveMedia, ArchiveStory } from '../archive/types';
import { loadMediaUrl } from '../archive/load';

type Chapter = ArchiveStory['chapters'][number];
type FeedItem =
  | { id: string; kind: 'cover'; story: ArchiveStory; media?: ArchiveMedia }
  | { id: string; kind: 'chapter'; story: ArchiveStory; chapter: Chapter; media?: ArchiveMedia }
  | { id: string; kind: 'photo'; story: ArchiveStory; chapter: Chapter; media: ArchiveMedia; number: number; total: number }
  | { id: string; kind: 'quote'; story: ArchiveStory; chapter: Chapter; speaker: string; text: string; avatar?: ArchiveMedia; avatarPosition?: string }
  | { id: string; kind: 'fact'; story: ArchiveStory; chapter: Chapter; fact: Chapter['facts'][number]; media?: ArchiveMedia };

function useDecryptedMedia(media: ArchiveMedia | undefined, archiveKey: CryptoKey, active: boolean, width = 1000) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!media || !active) return;
    let objectUrl: string | undefined;
    let mounted = true;
    void loadMediaUrl(media, archiveKey, width).then((next) => {
      objectUrl = next;
      if (mounted) setUrl(next);
      else URL.revokeObjectURL(next);
    });
    return () => { mounted = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [active, archiveKey, media, width]);
  return url;
}

function FeedImage({ media, archiveKey, active, className = 'feed-image', position }: { media?: ArchiveMedia; archiveKey: CryptoKey; active: boolean; className?: string; position?: string }) {
  const url = useDecryptedMedia(media, archiveKey, active);
  if (!url || !media) return <div className={`${className} feed-image-loading`} />;
  return <img className={className} src={url} alt={media.alt} style={position ? { objectPosition: position } : undefined} />;
}

function chapterMedia(chapter: Chapter, archive: ArchiveManifest) {
  const ids = [...new Set([chapter.mediaId, ...chapter.mediaIds].filter(Boolean))];
  return ids.map((id) => archive.media.find((media) => media.id === id)).filter((media): media is ArchiveMedia => Boolean(media));
}

function buildFeed(archive: ArchiveManifest): FeedItem[] {
  const result: FeedItem[] = [];
  const stories = [...archive.stories].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  for (const story of stories) {
    result.push({ id: `cover-${story.id}`, kind: 'cover', story, media: archive.media.find((media) => media.id === story.coverMediaId) });
    for (const chapter of story.chapters) {
      const photos = chapterMedia(chapter, archive);
      result.push({ id: `chapter-${story.id}-${chapter.id}`, kind: 'chapter', story, chapter, media: photos[0] });
      photos.forEach((media, index) => result.push({ id: `photo-${chapter.id}-${media.id}`, kind: 'photo', story, chapter, media, number: index + 1, total: photos.length }));
      chapter.quotes.forEach((quote, index) => {
        const narrator = archive.narrators.find((item) => item.name === quote.speaker);
        result.push({ id: `quote-${chapter.id}-${index}`, kind: 'quote', story, chapter, speaker: quote.speaker, text: quote.text, avatar: archive.media.find((media) => media.id === narrator?.mediaId), avatarPosition: narrator?.position });
      });
      chapter.facts.forEach((fact, index) => result.push({
        id: `fact-${chapter.id}-${index}`, kind: 'fact', story, chapter, fact,
        media: photos.find((media) => media.kind === 'external')
      }));
    }
  }
  return result;
}

function SourceLink({ url, label = 'Otevřít zdroj' }: { url: string; label?: string }) {
  return <a className="feed-source" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {label}</a>;
}

export function MobileFeed({ archive, archiveKey, onLock }: { archive: ArchiveManifest; archiveKey: CryptoKey; onLock: () => void }) {
  const items = useMemo(() => buildFeed(archive), [archive]);
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState<Chapter>();
  const feed = useRef<HTMLDivElement>(null);

  function onScroll() {
    const node = feed.current;
    if (!node) return;
    setActive(Math.max(0, Math.min(items.length - 1, Math.round(node.scrollTop / node.clientHeight))));
  }

  return (
    <div className="mobile-feed-shell">
      <header className="feed-topbar">
        <div className="feed-brand"><span>B</span><strong>{archive.familyName}</strong></div>
        <div className="feed-position"><span style={{ width: `${((active + 1) / items.length) * 100}%` }} /></div>
        <button onClick={onLock} aria-label="Zamknout kroniku"><LockKeyhole size={20} /></button>
      </header>

      <main className="mobile-feed" ref={feed} onScroll={onScroll} aria-label="Rodinná timeline">
        {items.map((item, index) => {
          const near = Math.abs(index - active) <= 1;
          const itemNumber = `${index + 1} / ${items.length}`;
          if (item.kind === 'cover') return (
            <article className="feed-card feed-cover" key={item.id} aria-label={`${item.story.title}, úvod`}>
              <FeedImage media={item.media} archiveKey={archiveKey} active={near} />
              <div className="feed-shade" />
              <div className="feed-copy feed-cover-copy">
                <p className="feed-overline">{item.story.timelineLabel} · {item.story.dateLabel}</p>
                <h1>{item.story.title}</h1>
                <p>{item.story.subtitle}</p>
                <div className="feed-places"><MapPin size={15} /> {item.story.places.join(' · ')}</div>
                {index === 0 && <div className="feed-swipe"><ArrowUp size={16} /> Přejeďte nahoru</div>}
              </div>
              <span className="feed-item-number">{itemNumber}</span>
            </article>
          );

          if (item.kind === 'chapter') return (
            <article className={`feed-card feed-story tone-${item.chapter.tone}`} key={item.id}>
              <FeedImage media={item.media} archiveKey={archiveKey} active={near} />
              <div className="feed-shade story-shade" />
              <div className="feed-copy">
                <p className="feed-overline">{item.chapter.eyebrow}</p>
                <h2>{item.chapter.title}</h2>
                <p className="feed-summary">{item.chapter.summary}</p>
                <button className="feed-detail-button" onClick={() => setDetail(item.chapter)}><BookOpen size={17} /> Číst celý příběh</button>
              </div>
              <span className="feed-item-number">{itemNumber}</span>
            </article>
          );

          if (item.kind === 'photo') return (
            <article className="feed-card feed-photo" key={item.id}>
              <FeedImage media={item.media} archiveKey={archiveKey} active={near} />
              <div className="feed-shade photo-shade" />
              <div className="feed-side-actions">
                <span className="feed-avatar-mini"><Images size={20} /></span>
                <small>{item.number}/{item.total}</small>
                {item.media.sourceUrl && <a href={item.media.sourceUrl} target="_blank" rel="noreferrer" aria-label="Otevřít zdroj fotografie"><ExternalLink size={21} /></a>}
              </div>
              <div className="feed-copy feed-photo-copy">
                <p className="feed-overline">{item.chapter.eyebrow}</p>
                <h2>{item.media.caption || item.chapter.title}</h2>
                <p>{item.media.alt}</p>
                {item.media.kind === 'external' && <div className="feed-credit">{item.media.credit} · {item.media.license}</div>}
                {item.media.sourceUrl && <SourceLink url={item.media.sourceUrl} label="Detail a licence" />}
              </div>
              <span className="feed-item-number">{itemNumber}</span>
            </article>
          );

          if (item.kind === 'quote') {
            return (
              <article className={`feed-card feed-quote tone-${item.chapter.tone}`} key={item.id}>
                <div className="quote-orbit" aria-hidden="true" />
                <div className="feed-quote-inner">
                  <QuoteIcon className="feed-quote-mark" size={42} />
                  <blockquote>{item.text}</blockquote>
                  <div className="feed-person">
                    {item.avatar ? <FeedImage media={item.avatar} archiveKey={archiveKey} active={near} className="feed-person-photo" position={item.avatarPosition} /> : <span className="feed-person-fallback">B</span>}
                    <div><strong>{item.speaker}</strong><small>Rodinná vzpomínka</small></div>
                  </div>
                </div>
                <span className="feed-item-number">{itemNumber}</span>
              </article>
            );
          }

          const source = item.fact.sources[0];
          return (
            <article className="feed-card feed-fact" key={item.id}>
              <FeedImage media={item.media} archiveKey={archiveKey} active={near} />
              <div className="feed-shade fact-shade" />
              <div className="feed-copy">
                <p className="feed-overline">Zajímavost · {item.chapter.eyebrow}</p>
                <h2>{item.fact.title}</h2>
                <p className="feed-summary">{item.fact.text}</p>
                {source && <SourceLink url={source.url} label={source.label} />}
              </div>
              <span className="feed-item-number">{itemNumber}</span>
            </article>
          );
        })}
      </main>

      <nav className="feed-bottom-bar" aria-label="Navigace feedu">
        <strong>Pro vás</strong><span>{items[active]?.kind === 'quote' ? 'Rodinný hlas' : items[active]?.kind === 'fact' ? 'Zajímavost' : 'Naše cesta'}</span>
      </nav>

      {detail && (
        <div className="mobile-story-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-detail-title">
          <div className="sheet-handle" />
          <button className="sheet-close" onClick={() => setDetail(undefined)} aria-label="Zavřít příběh"><X /></button>
          <p className="feed-overline">{detail.eyebrow}</p>
          <h2 id="mobile-detail-title">{detail.title}</h2>
          {detail.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {detail.quotes.map((quote) => <blockquote key={`${quote.speaker}-${quote.text}`}><QuoteIcon size={20} /><p>{quote.text}</p><footer>{quote.speaker}</footer></blockquote>)}
          {detail.facts.map((fact) => <section key={fact.title}><h3>{fact.title}</h3><p>{fact.text}</p>{fact.sources.map((source) => <SourceLink key={source.url} url={source.url} label={source.label} />)}</section>)}
        </div>
      )}
    </div>
  );
}
