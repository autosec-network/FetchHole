import { createHash } from 'node:crypto';

export class MemoryCache {
	protected cache = new Map<Request['url'], Map<Request, Response>>();

	private async hashRequestBody(request: Request, hashAlgorithm: Parameters<typeof createHash>[0] = 'sha512') {
		const hash = createHash(hashAlgorithm);
		hash.update(Buffer.from(await request.arrayBuffer()));
		return hash.digest('hex');
	}

	private async areRequestsEqual(cachedRequest: Request, newRequest: Request, ignoreMethod: boolean = false): Promise<boolean> {
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

	public put(request: RequestInfo, response: Response): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!(request instanceof Request)) {
				request = new Request(request);
			}

			// Follow cache specs https://developers.cloudflare.com/workers/runtime-apis/cache/#invalid-parameters
			if (request.method != 'GET') reject();
			if (response.status == 206) reject();
			if (response.headers.get('Vary') == '*') reject();

			if (response.ok) {
				try {
					this.cache.set(request.url, new Map<Request, Response>().set(request, response.clone()));
					resolve();
				} catch (error) {
					reject(error);
				}
			} else {
				reject(response.statusText);
			}
		});
	}

	public async match(request: RequestInfo, options?: CacheQueryOptions): Promise<Response | undefined> {
		if (!(request instanceof Request)) {
			request = new Request(request);
		}

		if (this.cache.has(request.url)) {
			for (const [cachedRequest, cachedResponse] of this.cache.get(request.url)!) {
				if (await this.areRequestsEqual(cachedRequest, request, options?.ignoreMethod)) {
					return cachedResponse.clone();
				} else {
					// Request doesn't match
					return undefined;
				}
			}
			return undefined;
		} else {
			// Cache doesn't exist
			return undefined;
		}
	}

	public async delete(request: RequestInfo, options?: CacheQueryOptions): Promise<boolean> {
		if (!(request instanceof Request)) {
			request = new Request(request);
		}

		if (this.cache.has(request.url)) {
			for (const [cachedRequest] of this.cache.get(request.url)!) {
				if (await this.areRequestsEqual(cachedRequest, request, options?.ignoreMethod)) {
					return this.cache.delete(request.url);
				} else {
					// Request doesn't match
					return false;
				}
			}
			return false;
		} else {
			// Cache doesn't exist
			return false;
		}
	}
}
