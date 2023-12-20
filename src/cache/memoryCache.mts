import { CacheType } from '../fetch/config.mjs';
import type { FetchHoleConfig, PotentialThirdPartyResponse } from '../fetch/types.js';
import { CacheBase } from './base.mjs';

export class MemoryCache extends CacheBase {
	protected cache = new Map<Request['url'], Map<Request, Response>>();

	public put(request: RequestInfo, response: Response, config: FetchHoleConfig = this.config): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!(request instanceof Request)) {
				request = new Request(request);
			}

			// Follow cache specs https://developers.cloudflare.com/workers/runtime-apis/cache/#invalid-parameters
			if (!config.cache.ignoreMethod && request.method != 'GET') reject();
			if (response.status == 206) reject();
			if (!config.cache.ignoreMethod && response.headers.get('Vary') == '*') reject();
			// TODO: cache.put returns a 413 error if Cache-Control instructs not to cache or if the response is too large.

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

	public async match(request: RequestInfo, config: FetchHoleConfig = this.config): Promise<Response | undefined> {
		if (!(request instanceof Request)) {
			request = new Request(request);
		}

		if (this.cache.has(request.url)) {
			for (const [cachedRequest, cachedResponse] of this.cache.get(request.url)!) {
				if (await this.areFetchesEqual(request, cachedRequest, config)) {
					// Clone to leave alone stored copy
					let clonedCachedResponse = cachedResponse.clone();

					const newResponseInfo: Record<keyof PotentialThirdPartyResponse, any> = {};
					// Will also copy third party properties like `cf` object
					Object.keys(clonedCachedResponse).forEach((key) => {
						newResponseInfo[key] = (clonedCachedResponse as PotentialThirdPartyResponse)[key];
					});

					const newHeaders = new Headers(clonedCachedResponse.headers);
					newHeaders.set('X-FetchHole-Cache-Status', `HIT-${CacheType.Memory}`);
					newResponseInfo['headers'] = newHeaders;

					return new Response(clonedCachedResponse.body, newResponseInfo);
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

	public async delete(request: RequestInfo, config: FetchHoleConfig = this.config): Promise<boolean> {
		if (!(request instanceof Request)) {
			request = new Request(request);
		}

		if (this.cache.has(request.url)) {
			for (const [cachedRequest] of this.cache.get(request.url)!) {
				if (await this.areFetchesEqual(request, cachedRequest, config)) {
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
