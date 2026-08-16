import { describe, expect, it } from 'vitest';
import { privateArchiveSchema } from './types';

const story = {
  id: 'test', title: 'Test', subtitle: 'Vzpomínka', dateLabel: 'Léto', timelineLabel: '2026', sortDate: '2026-08-01', places: ['Doma'],
  chapters: [{ id: 'zacatek', eyebrow: 'Začátek', title: 'Název', summary: 'Shrnutí', body: ['Text'], quotes: [], facts: [], tone: 'amber' }]
};

describe('archive validation', () => {
  it('accepts a story without media', () => {
    expect(privateArchiveSchema.parse({ schemaVersion: 1, familyName: 'Rodina', introduction: 'Úvod kroniky', stories: [story], media: [] }).stories).toHaveLength(1);
  });

  it('requires attribution for external photographs', () => {
    const result = privateArchiveSchema.safeParse({
      schemaVersion: 1, familyName: 'Rodina', introduction: 'Úvod kroniky', stories: [story],
      media: [{ id: 'foto', kind: 'external', alt: 'Pohled na město', variants: [{ path: 'x.jpg', mime: 'image/jpeg', width: 100, height: 100 }] }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown photograph in a chapter gallery', () => {
    const withGallery = { ...story, chapters: [{ ...story.chapters[0], mediaIds: ['missing-photo'] }] };
    const result = privateArchiveSchema.safeParse({ schemaVersion: 1, familyName: 'Rodina', introduction: 'Úvod kroniky', stories: [withGallery], media: [] });
    expect(result.success).toBe(false);
  });
});
