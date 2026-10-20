// Public demonstration copy only. Real query exports and CMS drafts never belong here.
// Change both the text and locale when translating; a locale setting does not translate copy.
export const publicArticles = [
  {
    slug: 'reliable-webhooks', locale: 'en', status: 'published',
    title: 'Plan reliable webhook deliveries',
    description: 'A small checklist for deciding how to identify, retry and observe webhook deliveries in an application.',
    paragraphs: [
      'Give each event an identifier and record which events have already been handled. A receiver can then recognize repeated deliveries instead of applying the same change twice.',
      'Separate temporary delivery failures from failures that require a person to intervene. Choose a retry limit and a delay policy that fit the application.',
      'Record delivery attempts and their outcomes. Review failed deliveries before replaying an event, especially when it changes data.',
    ],
  },
  {
    slug: 'unfinished-example', locale: 'es', status: 'draft',
    title: 'Borrador de ejemplo', description: 'This draft must never appear in the public build.',
    paragraphs: ['Review required.'],
  },
] as const;
