import { ArrowRight, MapPin } from 'lucide-react';
import type { ArchiveStory } from '../archive/types';

type Props = {
  introduction: string;
  stories: ArchiveStory[];
  onOpen: (id: string) => void;
};

export function Timeline({ introduction, stories, onOpen }: Props) {
  const sorted = [...stories].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  return (
    <main className="timeline-shell">
      <section className="timeline-hero">
        <p className="kicker">Naše společná paměť</p>
        <h1>Čas běží.<br /><em>Příběhy zůstávají.</em></h1>
        <p>{introduction}</p>
        <div className="scroll-cue"><span /> Posuňte se v čase</div>
      </section>

      <section className="timeline" aria-label="Rodinné příběhy">
        {sorted.map((story, index) => (
          <article className={`timeline-entry tone-${story.chapters[0]?.tone ?? 'amber'}`} key={story.id}>
            <div className="timeline-year">{story.timelineLabel}</div>
            <div className="timeline-dot" aria-hidden="true" />
            <button className="story-card" onClick={() => onOpen(story.id)}>
              <div className="story-card-art" aria-hidden="true">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div className="landscape-lines" />
              </div>
              <div className="story-card-copy">
                <p className="story-date">{story.dateLabel}</p>
                <h2>{story.title}</h2>
                <p>{story.subtitle}</p>
                <div className="places"><MapPin size={15} /> {story.places.join(' · ')}</div>
                <span className="read-story">Otevřít příběh <ArrowRight size={18} /></span>
              </div>
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
