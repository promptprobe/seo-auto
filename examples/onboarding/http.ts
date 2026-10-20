import { SetupError } from './config.js';

export type Http = (url: string, init: RequestInit) => Promise<Response>;

// Never forward credentials to a redirect target or include remote bodies in errors.
export async function requestJson<T>(http: Http, url: string, init: RequestInit, service: string) {
  let response: Response;
  try {
    response = await http(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new SetupError(`${service}: network, timeout or redirect error. Check the canonical HTTPS endpoint; see troubleshooting.md.`);
  }
  if (!response.ok) {
    const hint = response.status === 401 ? 'Check the credential and whether it expired.'
      : response.status === 403 ? 'Check API access and the account permissions.'
      : response.status === 429 ? 'Rate limited. Wait before retrying.'
      : 'Check the endpoint and service status.';
    throw new SetupError(`${service}: HTTP ${response.status}. ${hint}`);
  }
  try { return { data: await response.json() as T, response }; }
  catch { throw new SetupError(`${service}: expected JSON. A login page or security plugin may be intercepting the request.`); }
}
