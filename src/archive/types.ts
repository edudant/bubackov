import { z } from 'zod';

export const sourceSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  author: z.string().optional(),
  license: z.string().optional()
});

export const mediaVariantSchema = z.object({
  path: z.string().min(1),
  mime: z.enum(['image/avif', 'image/webp', 'image/jpeg']),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

const privateMediaBaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  kind: z.enum(['family', 'external']),
  alt: z.string().min(5),
  caption: z.string().optional(),
  credit: z.string().optional(),
  license: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  variants: z.array(mediaVariantSchema).min(1)
});

function requireExternalAttribution(media: { kind: 'family' | 'external'; credit?: string; license?: string; sourceUrl?: string }, context: z.RefinementCtx) {
  if (media.kind === 'external') {
    if (!media.credit) context.addIssue({ code: 'custom', path: ['credit'], message: 'Externí fotografie vyžaduje autora.' });
    if (!media.license) context.addIssue({ code: 'custom', path: ['license'], message: 'Externí fotografie vyžaduje licenci.' });
    if (!media.sourceUrl) context.addIssue({ code: 'custom', path: ['sourceUrl'], message: 'Externí fotografie vyžaduje zdrojovou URL.' });
  }
}

export const privateMediaSchema = privateMediaBaseSchema.superRefine(requireExternalAttribution);

export const quoteSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1)
});

export const factSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  sources: z.array(sourceSchema).default([])
});

export const chapterSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
  mediaId: z.string().optional(),
  mediaIds: z.array(z.string()).default([]),
  quotes: z.array(quoteSchema).default([]),
  facts: z.array(factSchema).default([]),
  tone: z.enum(['amber', 'forest', 'wine', 'night']).default('amber')
});

export const storySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  dateLabel: z.string().min(1),
  timelineLabel: z.string().min(1),
  sortDate: z.string().date(),
  places: z.array(z.string().min(1)).min(1),
  coverMediaId: z.string().optional(),
  albumUrl: z.string().url().optional(),
  chapters: z.array(chapterSchema).min(1)
});

const archiveCoreSchema = z.object({
  schemaVersion: z.literal(1),
  familyName: z.string().min(1),
  introduction: z.string().min(1),
  narrators: z.array(z.object({
    name: z.string().min(1),
    mediaId: z.string().min(1),
    position: z.string().optional()
  })).default([]),
  stories: z.array(storySchema).min(1)
});

function validateMediaReferences(
  archive: { stories: z.infer<typeof storySchema>[]; media: { id: string }[] },
  context: z.RefinementCtx
) {
  const mediaIds = new Set(archive.media.map((media) => media.id));
  if ('narrators' in archive && Array.isArray(archive.narrators)) {
    for (const [narratorIndex, narrator] of archive.narrators.entries()) {
      if (!mediaIds.has(narrator.mediaId)) {
        context.addIssue({ code: 'custom', path: ['narrators', narratorIndex, 'mediaId'], message: 'Neznámé médium.' });
      }
    }
  }
  for (const [storyIndex, story] of archive.stories.entries()) {
    if (story.coverMediaId && !mediaIds.has(story.coverMediaId)) {
      context.addIssue({ code: 'custom', path: ['stories', storyIndex, 'coverMediaId'], message: 'Neznámé médium.' });
    }
    for (const [chapterIndex, chapter] of story.chapters.entries()) {
      if (chapter.mediaId && !mediaIds.has(chapter.mediaId)) {
        context.addIssue({ code: 'custom', path: ['stories', storyIndex, 'chapters', chapterIndex, 'mediaId'], message: 'Neznámé médium.' });
      }
      for (const [mediaIndex, mediaId] of chapter.mediaIds.entries()) {
        if (!mediaIds.has(mediaId)) {
          context.addIssue({ code: 'custom', path: ['stories', storyIndex, 'chapters', chapterIndex, 'mediaIds', mediaIndex], message: 'Neznámé médium.' });
        }
      }
    }
  }
}

export const privateArchiveSchema = archiveCoreSchema.extend({
  media: z.array(privateMediaSchema).default([])
}).superRefine(validateMediaReferences);

export const encryptedMediaSchema = privateMediaBaseSchema.omit({ variants: true }).extend({
  variants: z.array(z.object({
    file: z.string().min(1),
    context: z.string().min(1),
    mime: mediaVariantSchema.shape.mime,
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })).min(1)
}).superRefine(requireExternalAttribution);

export const archiveManifestSchema = archiveCoreSchema.extend({
  media: z.array(encryptedMediaSchema)
}).superRefine(validateMediaReferences);

export const bootstrapSchema = z.object({
  format: z.literal('bubackov-archive-v1'),
  salt: z.string().min(1),
  manifest: z.string().min(1),
  manifestContext: z.literal('manifest'),
  kdf: z.object({
    algorithm: z.literal('argon2id'),
    iterations: z.number().int().positive(),
    memorySize: z.number().int().positive(),
    parallelism: z.number().int().positive(),
    hashLength: z.literal(32)
  })
});

export type PrivateArchive = z.infer<typeof privateArchiveSchema>;
export type ArchiveManifest = z.infer<typeof archiveManifestSchema>;
export type ArchiveStory = z.infer<typeof storySchema>;
export type ArchiveMedia = z.infer<typeof encryptedMediaSchema>;
export type Bootstrap = z.infer<typeof bootstrapSchema>;
