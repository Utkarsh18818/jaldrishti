export interface TemporaryCredentials { accessKeyId: string; secretAccessKey: string; sessionToken: string; }
export interface SigningOptions { credentials?: TemporaryCredentials; region?: string; service?: string; fetcher?: typeof fetch; now?: Date; }
export function temporaryCredentials(env?: Record<string, string | undefined>): TemporaryCredentials;
export function signedFetch(url: string | URL, init?: RequestInit, options?: SigningOptions): Promise<Response>;
export const secretKeys: string[];
export function validateRuntimeSecrets(env?: Record<string, string | undefined>): void;
export function invokeBackend(url: string | URL, init?: RequestInit, options?: { env?: Record<string, string | undefined>; transport?: typeof signedFetch }): Promise<Response>;
