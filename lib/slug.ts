import slugify from 'slugify';

export const createBaseSlug = (title: string) =>
  slugify(title, {
    lower: true,
    strict: true,
    trim: true
  });

export const appendSlugSuffix = (slug: string) => `${slug}-${Math.random().toString(36).slice(2, 8)}`;
