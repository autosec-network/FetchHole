import { createHash } from 'node:crypto';

export abstract class CacheBase {
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
		const headers1 = cachedFetch.headers.entries();
		const headers2 = newFetch.headers.entries();

		for (const [name1, value1] of headers1) {
			const [name2, value2] = headers2.next().value;
			if (name1 !== name2 || value1 !== value2) {
				return false;
			}
		}

		// Check if the request body is the same
		const [body1hash, body2hash] = await Promise.all([this.hashBody(cachedFetch), this.hashBody(newFetch)]);
		if (body1hash !== body2hash) {
			return false;
		}

		return true;
	}
}
