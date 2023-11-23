import { createHash } from 'node:crypto';

export abstract class CacheBase {
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

	protected async hashBody(request: Request | Response, hashAlgorithm: Parameters<typeof createHash>[0] = 'sha512'): Promise<string> {
		const hash = createHash(hashAlgorithm);
		hash.update(Buffer.from(await request.arrayBuffer()));
		return hash.digest('hex');
	}

	protected async areFetchesEqual(cachedFetch: Request | Response, newFetch: Request | Response, ignoreMethod: boolean = false): Promise<boolean> {
		// Check if the request URL and method are the same
		// When `ignoreMethod` is `true`, the request is considered to be a `GET` request regardless of its actual value
		if (cachedFetch.url !== newFetch.url) {
			return false;
		}
		if ('method' in cachedFetch && 'method' in newFetch) {
			if (cachedFetch.url !== newFetch.url || cachedFetch.method !== (ignoreMethod ? 'GET' : newFetch.method)) {
				return false;
			}
		}

		// Check if the request headers are the same
		if (!this.areHeadersEqual(cachedFetch.headers, newFetch.headers)) {
			return false;
		}

		// Check if the request body is the same
		const [body1hash, body2hash] = await Promise.all([this.hashBody(cachedFetch), this.hashBody(newFetch)]);
		if (body1hash !== body2hash) {
			return false;
		}

		return true;
	}
}
