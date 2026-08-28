import type { FaqItem } from '../types.js';

export interface ArticleSchemaInput {
  headline: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  authorUrl?: string;
  publisherName: string;
  publisherLogoUrl?: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildArticleJsonLd(input: ArticleSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.headline,
    description: input.description,
    url: input.canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.canonicalUrl },
    ...(input.imageUrl ? { image: [input.imageUrl] } : {}),
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      '@type': 'Person',
      name: input.authorName,
      ...(input.authorUrl ? { url: input.authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: input.publisherName,
      ...(input.publisherLogoUrl
        ? { logo: { '@type': 'ImageObject', url: input.publisherLogoUrl } }
        : {}),
    },
  };
}

export function buildFaqJsonLd(items: readonly FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
