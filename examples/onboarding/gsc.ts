import { opportunityDates, type OpportunitySnapshot, type OpportunityQueryRow } from '../../src/index.js';
import { SetupError } from './config.js';
import { requestJson, type Http } from './http.js';

interface GscRow { keys: string[]; clicks: number; impressions: number; position: number }
interface GscResponse { rows?: GscRow[]; responseAggregationType?: string }
export interface GscConfig { property: string; country?: string; device?: string }
const api = 'https://www.googleapis.com/webmasters/v3/sites/';
const pageSize = 25_000;

function metrics(row: GscRow): OpportunityQueryRow {
  if (!Array.isArray(row.keys) || ![row.clicks, row.impressions, row.position].every(Number.isFinite)
    || row.clicks < 0 || row.impressions < row.clicks || row.position < 0
    || (row.impressions > 0 && row.position <= 0)) throw new SetupError('GSC returned invalid metrics.');
  return { query: row.keys[0]!, clicks: row.clicks, impressions: row.impressions, position: row.position };
}

export async function checkGsc(config: GscConfig, token: string, http: Http = fetch) {
  const { data } = await requestJson<{ permissionLevel?: string }>(http, api + encodeURIComponent(config.property),
    { headers: { authorization: `Bearer ${token}` } }, 'GSC property');
  if (!data.permissionLevel || data.permissionLevel === 'siteUnverifiedUser') {
    throw new SetupError('GSC property access is not verified. Add the service account to this exact property.');
  }
  return { connected: true, permission: data.permissionLevel };
}

export async function readGsc(config: GscConfig, token: string, asOfDate: string, http: Http = fetch) {
  const notices = ['Search Console returns observed top rows; anonymized/omitted queries are not market-demand estimates.'];
  const filters = [
    ...(config.country ? [{ dimension: 'country', operator: 'equals', expression: config.country }] : []),
    ...(config.device ? [{ dimension: 'device', operator: 'equals', expression: config.device }] : []),
  ];
  async function query(startDate: string, endDate: string, dimensions: string[], aggregationType: string, startRow = 0) {
    const { data } = await requestJson<GscResponse>(http, `${api}${encodeURIComponent(config.property)}/searchAnalytics/query`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions, aggregationType, startRow,
        rowLimit: pageSize, type: 'web', dataState: 'final',
        ...(filters.length ? { dimensionFilterGroups: [{ groupType: 'and', filters }] } : {}),
      }),
    }, 'GSC analytics');
    if ((data.rows !== undefined && !Array.isArray(data.rows))
      || (data.responseAggregationType !== undefined && data.responseAggregationType !== aggregationType)
      || (data.rows?.length && data.responseAggregationType !== aggregationType)) {
      throw new SetupError('GSC aggregation did not match the requested scope.');
    }
    for (const row of data.rows ?? []) {
      metrics(row);
      if (row.keys.length !== dimensions.length || row.keys.some(key => typeof key !== 'string' || !key)) {
        throw new SetupError('GSC returned invalid dimensions.');
      }
    }
    return data.rows ?? [];
  }
  // The latest returned final date is evidence, not "today minus a guessed lag".
  const dates = await query(opportunityDates(asOfDate, 70)[0]!, asOfDate, ['date'], 'byProperty');
  const seenDates = new Set<string>();
  for (const row of dates) {
    const date = row.keys[0]!;
    if (opportunityDates(date, 1)[0] !== date || date > asOfDate || seenDates.has(date)) {
      throw new SetupError('GSC returned an invalid or duplicate date.');
    }
    seenDates.add(date);
  }
  const periodEnd = [...seenDates].sort().at(-1) ?? null;
  const snapshots: OpportunitySnapshot[] = [];
  if (!periodEnd) return { periodEnd, snapshots, notices: [...notices, 'No finalized observations yet.'] };
  const wanted = new Set(opportunityDates(periodEnd, 56));
  async function daily(date: string, dimensions: string[], aggregation: string) {
    const all: GscRow[] = [];
    const seen = new Set<string>();
    for (let startRow = 0; startRow < 50_000; startRow += pageSize) {
      const rows = await query(date, date, dimensions, aggregation, startRow);
      for (const row of rows) {
        const key = JSON.stringify(row.keys);
        if (seen.has(key)) throw new SetupError('GSC pagination repeated a row. Retry rather than double-counting observations.');
        seen.add(key);
      }
      all.push(...rows);
      if (rows.length < pageSize) return all;
    }
    notices.push(`Top-row limit reached for ${date} (${dimensions.join('/')}); attribution may be incomplete.`);
    return all;
  }
  for (const dateRow of dates.filter(row => wanted.has(row.keys[0]!)).sort((a, b) => a.keys[0]!.localeCompare(b.keys[0]!))) {
    const date = dateRow.keys[0]!;
    const queries = await daily(date, ['query'], 'byProperty');
    const pages = await daily(date, ['query', 'page'], 'byPage');
    snapshots.push({ date, finalized: true, propertyImpressions: dateRow.impressions,
      queries: queries.map(metrics), pages: pages.map(row => ({ ...metrics(row), page: row.keys[1]! })),
    });
  }
  // A date absent from the provider stays absent; do not fabricate a zero-filled day.
  return { periodEnd, snapshots, notices };
}
