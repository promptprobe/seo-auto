export class SetupError extends Error {}

export interface SiteConfig {
  siteUrl: string;
  locale: string;
  indexable: boolean;
}

export interface ConnectionConfig extends SiteConfig {
  property: string;
  country?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  wordpressUrl: string;
  wordpressUser: string;
  wordpressPassword: string;
  inventoryConfirmed: boolean;
  credentialsFile: string;
}

export function httpsUrl(value: string, name: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new SetupError(`${name} must be a complete HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new SetupError(`${name} must use HTTPS, without credentials, query parameters or a fragment.`);
  }
  return url;
}

function flag(value: string | undefined, name: string): boolean {
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  throw new SetupError(`${name} must be true or false.`);
}

export function siteConfig(env: NodeJS.ProcessEnv): SiteConfig {
  const url = httpsUrl(env.SITE_URL || 'https://example.com/', 'SITE_URL');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  let locale: string;
  try { locale = Intl.getCanonicalLocales(env.SITE_LOCALE || 'en')[0]!; }
  catch { throw new SetupError('SITE_LOCALE must be a language tag such as en, es-MX, ja or ar.'); }
  const indexable = flag(env.SITE_INDEXABLE, 'SITE_INDEXABLE');
  if (indexable && /(^|\.)example\.(com|org|net)$/.test(url.hostname)) {
    throw new SetupError('Set your own SITE_URL before enabling SITE_INDEXABLE.');
  }
  return { siteUrl: url.href, locale, indexable };
}

export function connectionConfig(env: NodeJS.ProcessEnv): ConnectionConfig {
  const required = ['SITE_URL', 'GSC_PROPERTY', 'GOOGLE_APPLICATION_CREDENTIALS',
    'WORDPRESS_URL', 'WORDPRESS_USER', 'WORDPRESS_APPLICATION_PASSWORD'] as const;
  const missing = required.filter(key => !env[key]?.trim());
  if (missing.length) throw new SetupError(`Missing settings: ${missing.join(', ')}. See docs/onboarding/README.md.`);
  const site = siteConfig(env);
  const property = env.GSC_PROPERTY!.trim();
  const siteUrl = new URL(site.siteUrl);
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice(10);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/i.test(domain)
      || !(siteUrl.hostname === domain || siteUrl.hostname.endsWith(`.${domain}`))) {
      throw new SetupError('GSC_PROPERTY must contain the domain of SITE_URL. Copy the exact property identifier.');
    }
  } else {
    const prefix = httpsUrl(property, 'GSC_PROPERTY');
    if (siteUrl.origin !== prefix.origin || !siteUrl.pathname.startsWith(prefix.pathname)) {
      throw new SetupError('SITE_URL must be inside the URL-prefix GSC_PROPERTY (including www and path).');
    }
  }
  const country = env.GSC_COUNTRY?.trim().toLowerCase();
  if (country && !/^[a-z]{3}$/.test(country)) throw new SetupError('GSC_COUNTRY must be a three-letter country code, or empty for worldwide.');
  const device = env.GSC_DEVICE?.trim().toLowerCase();
  if (device && !['desktop', 'mobile', 'tablet'].includes(device)) throw new SetupError('GSC_DEVICE must be desktop, mobile, tablet, or empty.');
  const wordpress = httpsUrl(env.WORDPRESS_URL!.trim(), 'WORDPRESS_URL');
  if (!wordpress.pathname.endsWith('/')) wordpress.pathname += '/';
  return {
    ...site, property, ...(country ? { country } : {}),
    ...(device ? { device: device as ConnectionConfig['device'] & string } : {}),
    wordpressUrl: wordpress.href,
    wordpressUser: env.WORDPRESS_USER!.trim(),
    wordpressPassword: env.WORDPRESS_APPLICATION_PASSWORD!,
    credentialsFile: env.GOOGLE_APPLICATION_CREDENTIALS!.trim(),
    inventoryConfirmed: flag(env.WORDPRESS_INVENTORY_COMPLETE, 'WORDPRESS_INVENTORY_COMPLETE'),
  };
}

export function pacificDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}
