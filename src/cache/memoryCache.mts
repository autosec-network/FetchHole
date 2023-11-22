import { CacheBase } from './base.mjs';

export class MemoryCache extends CacheBase {
	protected cache = new Map<Request['url'], Map<Request, Response>>();

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
