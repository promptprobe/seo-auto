import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse } from 'dotenv';
import { buildContentOpportunities } from '../../src/index.js';
import { connectionConfig, pacificDate, siteConfig, SetupError } from './config.js';
import { checkGsc, readGsc } from './gsc.js';
import { readWordPress, applyOwnership } from './wordpress.js';
import { demoInput } from './fixtures.js';
import { reviewOutputs } from './outputs.js';
import { buildDemoSite } from './site.js';

async function main() {
  const command = process.argv[2];
  if (!['demo', 'doctor', 'sync', 'site'].includes(command ?? '')) {
    throw new SetupError('Choose onboarding:demo, onboarding:doctor, onboarding:sync or onboarding:site. See docs/onboarding/README.md.');
  }
  // Demo never loads credentials. Process environment takes precedence over .env.local.
  const local = command === 'demo' ? {} : await readFile('.env.local', 'utf8').then(parse).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return {};
    throw new SetupError('Cannot read .env.local.');
  });
  const env = { ...local, ...process.env };
  if (command === 'site') {
    // Explicit public input only: never import .seo-auto outputs or CMS responses.
    const files = buildDemoSite(siteConfig(env));
    const output = resolve('site-dist');
    await rm(output, { recursive: true, force: true });
    for (const [name, content] of Object.entries(files)) {
      const path = resolve(output, name);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    }
    console.log(`Built ${Object.keys(files).length} public fixture files in site-dist/. No credentials or private reports are included.`);
    return;
  }
  let input = demoInput();
  let locale = 'en';
  let notices: string[] = ['Synthetic demo: not real search data.'];
  let scope: object = { mode: 'demo', geography: 'worldwide', searchType: 'web' };
  if (command !== 'demo') {
    const config = connectionConfig(env);
    const { GoogleAuth } = await import('google-auth-library');
    let token: string;
    try {
      const auth = new GoogleAuth({ keyFilename: config.credentialsFile,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'] });
      token = (await auth.getAccessToken())!;
      if (!token) throw new Error('No access token');
    } catch {
      throw new SetupError('Google authentication failed. Check GOOGLE_APPLICATION_CREDENTIALS and the local credential file. No credential values were logged.');
    }
    const access = await checkGsc(config, token);
    const cms = await readWordPress(config);
    if (env.WORDPRESS_OWNERSHIP_FILE) {
      let mappings: unknown;
      try { mappings = JSON.parse(await readFile(env.WORDPRESS_OWNERSHIP_FILE, 'utf8')); }
      catch { throw new SetupError('Cannot read WORDPRESS_OWNERSHIP_FILE as JSON. Check its path and format.'); }
      cms.inventory = applyOwnership(cms.inventory, mappings);
    }
    if (command === 'doctor') {
      console.log(JSON.stringify({ gsc: access, wordpress: { connected: true, items: cms.inventory.length,
        inventoryComplete: cms.inventoryComplete }, notices: cms.notices }, null, 2));
      return;
    }
    console.log('Reading finalized GSC observations and CMS inventory. This may take a few minutes; no remote content is written.');
    const asOfDate = pacificDate();
    const data = await readGsc(config, token, asOfDate);
    input = { ...data, asOfDate, inventory: cms.inventory, inventoryComplete: cms.inventoryComplete };
    locale = config.locale; notices = [...data.notices, ...cms.notices];
    scope = { mode: 'live-read-only', property: config.property, country: config.country ?? 'worldwide',
      device: config.device ?? 'all', searchType: 'web', googleDateTimezone: 'America/Los_Angeles' };
  }
  const report = buildContentOpportunities(input);
  const outputs = reviewOutputs(report, locale);
  // Separate runs prevent synthetic and live observations from being mistaken for each other.
  const directory = resolve('.seo-auto', command === 'demo' ? 'demo' : 'live');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const artifacts = { 'report.json': { source: scope, syncedAt: new Date().toISOString(), notices, report },
    'inventory.json': input.inventory,
    'review-briefs.json': outputs.briefs, 'wordpress-draft.json': outputs.wordpressDraft };
  for (const [name, content] of Object.entries(artifacts)) {
    await writeFile(resolve(directory, name), JSON.stringify(content, null, 2) + '\n', { mode: 0o600 });
  }
  console.log(JSON.stringify({ source: scope, status: report.status, period: report.period,
    queries: report.rows.length, scored: report.rows.filter(row => row.score !== null).length,
    actions: report.rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.action]: (counts[row.action] ?? 0) + 1 }), {}),
    inventoryComplete: report.coverage.inventoryComplete, notices, output: directory }, null, 2));
}

main().catch((error: unknown) => {
  // SDK/fetch error objects can contain headers; never print the raw exception.
  console.error(error instanceof SetupError ? error.message : 'The example failed. Check configuration and docs/onboarding/troubleshooting.md. Raw errors are suppressed to protect credentials.');
  process.exitCode = 1;
});
