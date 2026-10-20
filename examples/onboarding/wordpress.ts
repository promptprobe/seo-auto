import type { OpportunityContent } from '../../src/index.js';
import { SetupError } from './config.js';
import { requestJson, type Http } from './http.js';

export interface WordPressConfig {
  wordpressUrl: string;
  wordpressUser: string;
  wordpressPassword: string;
  inventoryConfirmed: boolean;
}
interface WpUser { id: number; capabilities?: Record<string, boolean> }
interface WpPost { id: number; link: string; status: string; title: { raw?: string; rendered?: string } }

export async function readWordPress(config: WordPressConfig, http: Http = fetch) {
  if (config.wordpressUser.includes(':')) throw new SetupError('WORDPRESS_USER cannot contain a colon.');
  const authorization = `Basic ${Buffer.from(`${config.wordpressUser}:${config.wordpressPassword}`).toString('base64')}`;
  async function get<T>(path: string) {
    return requestJson<T>(http, new URL(`wp-json/wp/v2/${path}`, config.wordpressUrl).href,
      { method: 'GET', headers: { authorization } }, 'WordPress');
  }
  const { data: user } = await get<WpUser>('users/me?context=edit');
  if (!Number.isInteger(user.id) || user.id < 1) throw new SetupError('WordPress did not identify the authenticated user.');
  const caps = user.capabilities ?? {};
  const canReadAll = ['edit_others_posts', 'read_private_posts', 'edit_others_pages', 'read_private_pages']
    .every(capability => caps[capability] === true);
  const inventory: OpportunityContent[] = [];
  const notices: string[] = [];
  if (!canReadAll) notices.push('This account cannot establish a complete site inventory. New-article recommendations stay blocked.');
  for (const resource of ['posts', 'pages'] as const) {
    let totalPages: number | undefined;
    let expectedTotal: number | undefined;
    let count = 0;
    const ids = new Set<number>();
    for (let page = 1; ; page++) {
      const params = new URLSearchParams({ context: 'edit', status: 'publish,draft,pending,future,private',
        per_page: '100', page: String(page), orderby: 'id', order: 'asc', _fields: 'id,link,status,title' });
      const { data, response } = await get<WpPost[]>(`${resource}?${params}`);
      const pages = Number(response.headers.get('x-wp-totalpages'));
      const total = Number(response.headers.get('x-wp-total'));
      if (!response.headers.has('x-wp-totalpages') || !response.headers.has('x-wp-total')
        || !Number.isSafeInteger(pages) || pages < 0 || pages > 1_000 || !Number.isSafeInteger(total) || total < 0
        || pages !== Math.ceil(total / 100)
        || !Array.isArray(data) || (totalPages !== undefined && (totalPages !== pages || expectedTotal !== total))) {
        throw new SetupError('WordPress pagination is missing or changed during the read. Retry; do not assume inventory is complete.');
      }
      totalPages = pages; expectedTotal = total;
      for (const post of data) {
        if (!Number.isInteger(post.id) || ids.has(post.id)
          || !['publish', 'draft', 'pending', 'future', 'private'].includes(post.status)
          || !post.title || typeof post.link !== 'string' || !/^https?:\/\//.test(post.link)) {
          throw new SetupError('WordPress returned an invalid or duplicate content item.');
        }
        ids.add(post.id); count++;
        inventory.push({ id: `${resource}:${post.id}`, url: post.link,
          title: post.title.raw ?? post.title.rendered ?? '(Untitled)',
          status: post.status === 'publish' ? 'published' : 'draft',
          kind: resource === 'posts' ? 'article' : 'other', queries: [],
        });
      }
      if (page >= totalPages) break;
    }
    if (count !== expectedTotal) throw new SetupError('WordPress inventory count does not match its pagination headers.');
  }
  const inventoryComplete = canReadAll && config.inventoryConfirmed;
  if (!config.inventoryConfirmed) notices.push('Inventory not confirmed. Check custom post types, other sites and page ownership before setting WORDPRESS_INVENTORY_COMPLETE=true.');
  return { inventory, inventoryComplete, notices, userId: user.id };
}

/** Optional local editorial mappings. Never infer draft ownership from a similar title. */
export function applyOwnership(inventory: OpportunityContent[], value: unknown): OpportunityContent[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SetupError('Ownership file must be an object keyed by content ID.');
  const mappings = value as Record<string, unknown>;
  const ids = new Set(inventory.map(item => item.id));
  for (const id of Object.keys(mappings)) if (!ids.has(id)) throw new SetupError('Ownership file refers to an ID not present in the CMS inventory.');
  return inventory.map(item => {
    const mapping = mappings[item.id];
    if (mapping === undefined) return item;
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw new SetupError('Invalid ownership entry.');
    const data = mapping as Record<string, unknown>;
    if (Object.keys(data).some(key => !['queries', 'kind', 'aliases'].includes(key))
      || !Array.isArray(data.queries) || !data.queries.every(q => typeof q === 'string' && q.trim())
      || (data.kind !== undefined && !['article', 'hub', 'other'].includes(String(data.kind)))
      || (data.aliases !== undefined && (!Array.isArray(data.aliases) || !data.aliases.every(alias => {
        if (typeof alias !== 'string') return false;
        try { const url = new URL(alias); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
        catch { return false; }
      })))) throw new SetupError('Ownership entries require queries, with optional kind and canonical URL aliases.');
    return { ...item, queries: data.queries as string[],
      ...(data.kind ? { kind: data.kind as OpportunityContent['kind'] } : {}),
      ...(data.aliases ? { aliases: data.aliases as string[] } : {}),
    };
  });
}
