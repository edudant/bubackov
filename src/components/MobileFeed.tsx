import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Images, LockKeyhole, MapPin, Quote as QuoteIcon } from 'lucide-react';
import type { ArchiveManifest, ArchiveMedia, ArchiveStory } from '../archive/types';
import { loadMediaUrl } from '../archive/load';

type Chapter = ArchiveStory['chapters'][number];
type Narrator = ArchiveManifest['narrators'][number];

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
    return () => {
      mounted = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [active, archiveKey, media, width]);

  return url;
}

function FeedImage({ media, archiveKey, active, className = 'social-image', position }: {
  media?: ArchiveMedia;
  archiveKey: CryptoKey;
  active: boolean;
  className?: string;
  position?: string;
}) {
  const url = useDecryptedMedia(media, archiveKey, active);
  if (!url || !media) return <div className={`${className} social-image-loading`} />;
  return <img className={className} src={url} alt={media.alt} style={position ? { objectPosition: position } : undefined} />;
}

function chapterMedia(chapter: Chapter, archive: ArchiveManifest) {
  const ids = [...new Set([chapter.mediaId, ...chapter.mediaIds].filter(Boolean))];
  return ids.map((id) => archive.media.find((media) => media.id === id)).filter((media): media is ArchiveMedia => Boolean(media));
}

function useNearViewport() {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: '80% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, near };
}

function PersonAvatar({ narrator, archive, archiveKey, active, size = 'regular' }: {
  narrator?: Narrator;
  archive: ArchiveManifest;
  archiveKey: CryptoKey;
  active: boolean;
  size?: 'regular' | 'small';
}) {
  const media = archive.media.find((item) => item.id === narrator?.mediaId);
  if (!media) return <span className={`social-avatar social-avatar-${size}`}>B</span>;
  return <FeedImage media={media} archiveKey={archiveKey} active={active} className={`social-avatar social-avatar-${size}`} position={narrator?.position} />;
}

function ExpandableStory({ chapter }: { chapter: Chapter }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="social-story-text">
      <p className="social-summary">{chapter.summary}</p>
      {expanded && <div className="social-story-more">{chapter.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>}
      <button className="social-more-button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        {expanded ? <><ChevronUp size={16} /> Zobrazit méně</> : <><ChevronDown size={16} /> Zobrazit více</>}
      </button>
    </div>
  );
}

function PhotoCarousel({ media, chapter, archiveKey, active }: {
  media: ArchiveMedia[];
  chapter: Chapter;
  archiveKey: CryptoKey;
  active: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  function onScroll() {
    const element = track.current;
    if (!element) return;
    setCurrent(Math.round(element.scrollLeft / element.clientWidth));
  }

  if (!media.length) return null;

  return (
    <div className="social-gallery-wrap">
      <div className="social-gallery" ref={track} onScroll={onScroll} aria-label={`Galerie kapitoly ${chapter.title}, ${media.length} fotografií`}>
        {media.map((item, index) => (
          <figure className="social-slide" key={item.id}>
            <FeedImage media={item} archiveKey={archiveKey} active={active && Math.abs(index - current) <= 1} />
            <figcaption>
              <strong>{item.caption || chapter.title}</strong>
              <span>{item.alt}</span>
              {item.kind === 'external' && <small>{item.credit} · {item.license}</small>}
              {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Zdroj a licence</a>}
            </figcaption>
          </figure>
        ))}
      </div>
      {media.length > 1 && (
        <div className="social-gallery-meta">
          <span className="social-gallery-hint"><Images size={15} /> Táhněte do strany</span>
          <div className="social-dots" aria-label={`Fotografie ${current + 1} z ${media.length}`}>
            {media.map((item, index) => <i key={item.id} className={index === current ? 'active' : ''} />)}
          </div>
          <span>{current + 1}/{media.length}</span>
        </div>
      )}
    </div>
  );
}

function ChapterPost({ story, chapter, archive, archiveKey }: {
  story: ArchiveStory;
  chapter: Chapter;
  archive: ArchiveManifest;
  archiveKey: CryptoKey;
}) {
  const { ref, near } = useNearViewport();
  const media = useMemo(() => chapterMedia(chapter, archive), [archive, chapter]);
  const primarySpeaker = chapter.quotes[0]?.speaker;
  const narrator = archive.narrators.find((item) => item.name === primarySpeaker);

  return (
    <article className={`social-post tone-${chapter.tone}`} ref={ref}>
      <header className="social-post-header">
        <PersonAvatar narrator={narrator} archive={archive} archiveKey={archiveKey} active={near} />
        <div>
          <strong>{primarySpeaker || archive.familyName}</strong>
          <span>{chapter.eyebrow} · {story.title}</span>
        </div>
      </header>

      <div className="social-post-intro">
        <h2>{chapter.title}</h2>
        <ExpandableStory chapter={chapter} />
      </div>

      <PhotoCarousel media={media} chapter={chapter} archiveKey={archiveKey} active={near} />

      {(chapter.quotes.length > 0 || chapter.facts.length > 0) && (
        <div className="social-post-extras">
          {chapter.quotes.map((quote) => {
            const quoteNarrator = archive.narrators.find((item) => item.name === quote.speaker);
            return (
              <blockquote className="social-memory" key={`${quote.speaker}-${quote.text}`}>
                <PersonAvatar narrator={quoteNarrator} archive={archive} archiveKey={archiveKey} active={near} size="small" />
                <div><QuoteIcon size={15} /><p>{quote.text}</p><footer>{quote.speaker}</footer></div>
              </blockquote>
            );
          })}
          {chapter.facts.map((fact) => (
            <section className="social-fact" key={fact.title}>
              <span>Zajímavost</span>
              <h3>{fact.title}</h3>
              <p>{fact.text}</p>
              {fact.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {source.label}</a>)}
            </section>
          ))}
        </div>
      )}
    </article>
  );
}

function StoryIntro({ story, archive, archiveKey }: { story: ArchiveStory; archive: ArchiveManifest; archiveKey: CryptoKey }) {
  const { ref, near } = useNearViewport();
  const cover = archive.media.find((media) => media.id === story.coverMediaId);
  return (
    <article className="social-story-intro" ref={ref}>
      <div className="social-story-cover">
        <FeedImage media={cover} archiveKey={archiveKey} active={near} />
        <div className="social-cover-shade" />
        <div className="social-cover-copy">
          <p>{story.timelineLabel} · {story.dateLabel}</p>
          <h1>{story.title}</h1>
          <span>{story.subtitle}</span>
        </div>
      </div>
      <div className="social-intro-meta"><MapPin size={16} /><span>{story.places.join(' · ')}</span></div>
      {story.albumUrl && <a className="social-album-link" href={story.albumUrl} target="_blank" rel="noreferrer"><Images size={17} /> Otevřít celé album</a>}
    </article>
  );
}

export function MobileFeed({ archive, archiveKey, onLock }: { archive: ArchiveManifest; archiveKey: CryptoKey; onLock: () => void }) {
  const stories = useMemo(() => [...archive.stories].sort((a, b) => b.sortDate.localeCompare(a.sortDate)), [archive.stories]);
  const postCount = stories.reduce((count, story) => count + story.chapters.length, 0);

  return (
    <div className="mobile-social-shell">
      <header className="social-topbar">
        <div className="social-brand"><span>B</span><div><strong>{archive.familyName}</strong><small>Rodinná kronika</small></div></div>
        <button onClick={onLock} aria-label="Zamknout kroniku"><LockKeyhole size={19} /></button>
      </header>

      <main className="mobile-social-feed" aria-label="Rodinná timeline">
        <div className="social-feed-heading"><strong>Naše příběhy</strong><span>{postCount} kapitol</span></div>
        {stories.map((story) => (
          <section className="social-story" key={story.id} aria-label={story.title}>
            <StoryIntro story={story} archive={archive} archiveKey={archiveKey} />
            {story.chapters.map((chapter) => <ChapterPost key={chapter.id} story={story} chapter={chapter} archive={archive} archiveKey={archiveKey} />)}
          </section>
        ))}
        <footer className="social-feed-end"><span>B</span><strong>Tohle je zatím všechno.</strong><p>Další vzpomínky sem přibudou jako nové příspěvky.</p></footer>
      </main>
    </div>
  );
}
