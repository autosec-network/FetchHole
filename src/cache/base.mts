import { createHash } from 'node:crypto';
import { defaultConfig } from '../fetch/config.mjs';
import type { FetchHoleConfig } from '../fetch/types.js';

export abstract class CacheBase {
	protected config: FetchHoleConfig;

	constructor(config: Partial<FetchHoleConfig> = {}) {
		this.config = {
			...defaultConfig,
			...config,
		};
	}

	protected areHeadersEqual(headers1: Headers, headers2: Headers): boolean {
		const entries1 = headers1.entries();

		if (Array.from(entries1).length !== Array.from(headers2.entries()).length) {
			return false;
		}

		for (const [key, value] of entries1) {
			if (headers2.get(key) !== value) {
				return false;
			}
		}

		return true;
	}

	protected async hashBody(request: Request | Response, hashAlgorithm: Parameters<typeof createHash>[0] = this.config.hashAlgorithm) {
		const hash = createHash(hashAlgorithm);

		if (request.body) {
			for await (const chunk of request.clone().body as any as AsyncIterable<Uint8Array | undefined>) {
				hash.update(Buffer.from(chunk ?? ''));
			}
		}

		return hash.digest('hex');
	}

	protected async areFetchesEqual(cachedFetch: Request | Response, newFetch: Request | Response, ignoreMethod: boolean = false, config: FetchHoleConfig = this.config): Promise<boolean> {
		// Check if the request URL and method are the same
		// When `ignoreMethod` is `true`, the request is considered to be a `GET` request regardless of its actual value
		if (cachedFetch.url !== newFetch.url) {
			return false;
		}
		if ('method' in cachedFetch && 'method' in newFetch) {
			if (cachedFetch.url !== newFetch.url || (ignoreMethod ? 'GET' : cachedFetch.method) !== (ignoreMethod ? 'GET' : newFetch.method)) {
				return false;
			}
		}

		// Check if the request headers are the same
		if (!this.areHeadersEqual(cachedFetch.headers, newFetch.headers)) {
			return false;
		}

		// Check if the request body is the same
		const [body1hash, body2hash] = await Promise.all([this.hashBody(cachedFetch, config.hashAlgorithm), this.hashBody(newFetch, config.hashAlgorithm)]);
		if (body1hash !== body2hash) {
			return false;
		}

		return true;
	}
}
