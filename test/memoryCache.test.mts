import { strictEqual } from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MemoryCache } from '../src/memoryCache.mjs';

describe('MemoryCache Tests', () => {
	let memoryCache: MemoryCache;

	beforeEach(() => {
		memoryCache = new MemoryCache();
	});

	it('should add and retrieve items from cache', async () => {
		const request = new Request('http://example.com');
		const response = new Response('response body');

		await memoryCache.put(request, response);
		const cachedResponse = await memoryCache.match(request);

		// Check if the response we get back is the same as what we put in.
		// strictEqual(await cachedResponse?.text(), await response.text(), 'Cached response should match the original response');
		strictEqual(...(await Promise.all([cachedResponse?.text(), response.text()])), 'Cached response should match the original response');
	});

	it('should not retrieve non-matching items from cache', async () => {
		const request1 = new Request('http://example.com');
		const request2 = new Request('http://example2.com');
		const response = new Response('response body');

		await memoryCache.put(request1, response);

		const cachedResponse = await memoryCache.match(request2);

		strictEqual(cachedResponse, undefined, 'Non-matching request should not retrieve a response');
	});

	it('should delete items from cache', async () => {
		const request = new Request('http://example.com');
		const response = new Response('response body');

		await memoryCache.put(request, response);
		const deleteResult = await memoryCache.delete(request);

		strictEqual(deleteResult, true, 'Response should be deleted');
		const cachedResponse = await memoryCache.match(request);
		strictEqual(cachedResponse, undefined, 'No response should be found after deletion');
	});
});
