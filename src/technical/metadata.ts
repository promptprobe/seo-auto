export interface SeoMetadataInput {
  siteName: string;
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  locale?: string;
  type?: 'website' | 'article';
  index?: boolean;
  follow?: boolean;
}

export interface SeoMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: { index: boolean; follow: boolean };
  openGraph: {
    type: 'website' | 'article';
    title: string;
    description: string;
    url: string;
    siteName: string;
    locale: string;
    images: readonly string[];
  };
  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    images: readonly string[];
  };
}

export function buildSeoMetadata(input: SeoMetadataInput): SeoMetadata {
  const images = input.imageUrl ? [input.imageUrl] : [];
  return {
    title: input.title,
    description: input.description,
    canonical: input.canonicalUrl,
    robots: {
      index: input.index ?? true,
      follow: input.follow ?? true,
    },
    openGraph: {
      type: input.type ?? 'article',
      title: input.title,
      description: input.description,
      url: input.canonicalUrl,
      siteName: input.siteName,
      locale: input.locale ?? 'en_US',
      images,
    },
    twitter: {
      card: input.imageUrl ? 'summary_large_image' : 'summary',
      title: input.title,
      description: input.description,
      images,
    },
  };
}
