import { createHash } from 'node:crypto';

export abstract class CacheBase {
	protected async hashRequestBody(request: Request | Response, hashAlgorithm: Parameters<typeof createHash>[0] = 'sha512') {
		const hash = createHash(hashAlgorithm);
		hash.update(Buffer.from(await request.arrayBuffer()));
		return hash.digest('hex');
	}

	protected async areRequestsEqual(cachedRequest: Request, newRequest: Request, ignoreMethod: boolean = false): Promise<boolean> {
		// Check if the request URL and method are the same
		// When `ignoreMethod` is `true`, the request is considered to be a `GET` request regardless of its actual value
		if (cachedRequest.url !== newRequest.url || cachedRequest.method !== (ignoreMethod ? 'GET' : newRequest.method)) {
			return false;
		}

		// Check if the request headers are the same
		// @ts-ignore
		const headers1 = cachedRequest.headers.entries();
		// @ts-ignore
		const headers2 = newRequest.headers.entries();

		for (const [name1, value1] of headers1) {
			const [name2, value2] = headers2.next().value;
			if (name1 !== name2 || value1 !== value2) {
				return false;
			}
		}

		// Check if the request body is the same
		const [body1hash, body2hash] = await Promise.all([this.hashRequestBody(cachedRequest), this.hashRequestBody(newRequest)]);
		if (body1hash !== body2hash) {
			return false;
		}

		return true;
	}
}
