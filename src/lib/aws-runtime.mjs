// Node-only AWS transport. Never import from a client component.
import { createHash, createHmac } from 'node:crypto';
import { SignatureV4 } from '@smithy/signature-v4';
class Sha256 {
  constructor(secret) { this.hash = secret === undefined ? createHash('sha256') : createHmac('sha256', secret); }
  update(value) { this.hash.update(value); }
  async digest() { return this.hash.digest(); }
}
export function temporaryCredentials(env = process.env) {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_SESSION_TOKEN)
    throw new Error('Temporary AWS credentials are required.');
  // Read on each call so managed-runtime credentials can refresh. No local key fallback.
  return { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, sessionToken: env.AWS_SESSION_TOKEN };
}
export async function signedFetch(url, init = {}, options = {}) {
  const target = new URL(url);
  const region = options.region ?? process.env.AWS_REGION ?? 'ap-southeast-2';
  const service = options.service ?? 'execute-api';
  if (!['execute-api', 'lambda'].includes(service)) throw new Error('Unapproved AWS service.');
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash ||
      (service === 'execute-api' && !new RegExp(`^[a-z0-9]+\\.execute-api\\.${region.replaceAll('.', '\\.')}\\.amazonaws\\.com$`).test(target.hostname)) ||
      (service === 'lambda' && target.hostname !== `lambda.${region}.amazonaws.com`)) throw new Error('Unapproved AWS target.');
  const credentials = options.credentials ?? temporaryCredentials();
  if (!credentials.sessionToken) throw new Error('Temporary AWS credentials are required.');
  const signer = new SignatureV4({ credentials, region, service, sha256: Sha256 });
  const body = init.body ?? '';
  if (typeof body !== 'string') throw new Error('AWS request body must be serialized once.');
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  delete headers.authorization; delete headers['x-amz-security-token'];
  const signed = await signer.sign({ method: init.method ?? 'GET', protocol: target.protocol, hostname: target.hostname,
    path: target.pathname, headers: { ...headers, host: target.host }, body }, options.now ? { signingDate: options.now } : undefined);
  return (options.fetcher ?? fetch)(target, { ...init, headers: signed.headers, redirect: 'error', cache: 'no-store',
    signal: init.signal ?? AbortSignal.timeout(20000) });
}
export const secretKeys = ['JALDRISHTI_ACCESS_CODE', 'JALDRISHTI_SESSION_SECRET', 'JALDRISHTI_BACKEND_TOKEN'];
export function validateRuntimeSecrets(env = process.env) {
  // Lambda injects its encrypted server environment at runtime. Never build these into code.
  const values = secretKeys.map(key => env[key]);
  if (values.some(v => typeof v !== 'string' || v.length < 32) || new Set(values).size !== 3)
    throw new Error('Runtime secrets unavailable.');
}
export async function invokeBackend(url, init = {}, options = {}) {
  const target = new URL(url), method = init.method ?? 'GET', path = target.pathname;
  if (target.origin !== 'https://lambda-backend.invalid' || target.search || target.hash ||
    !(method === 'POST' && path === '/forecast' ||
      method === 'GET' && /^\/(campus|environment)\/(real-site|pune-demo-campus)$/.test(path) ||
      method === 'PUT' && /^\/campus\/(real-site|pune-demo-campus)$/.test(path))) throw new Error('Unapproved backend operation.');
  const env = options.env ?? process.env;
  const name = env.JALDRISHTI_BACKEND_FUNCTION_NAME ?? 'jaldrishti-real-backend';
  if (name !== 'jaldrishti-real-backend') throw new Error('Unapproved backend function.');
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const event = { rawPath: path, requestContext: { http: { method } }, headers, isBase64Encoded: false,
    ...(init.body == null ? {} : { body: init.body }) };
  const response = await (options.transport ?? signedFetch)(`https://lambda.${env.AWS_REGION ?? 'ap-southeast-2'}.amazonaws.com/2015-03-31/functions/${name}/invocations`, {
    method: 'POST', body: JSON.stringify(event), headers: { 'content-type': 'application/json', 'x-amz-invocation-type': 'RequestResponse' }, signal: init.signal,
  }, { service: 'lambda', region: env.AWS_REGION ?? 'ap-southeast-2' });
  if (!response.ok || response.headers.has('x-amz-function-error')) throw new Error('Backend invocation unavailable.');
  const result = await response.json();
  if (!Number.isInteger(result.statusCode) || result.statusCode < 200 || result.statusCode > 599 || typeof result.body !== 'string')
    throw new Error('Invalid backend invocation response.');
  return new Response(result.body, { status: result.statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
