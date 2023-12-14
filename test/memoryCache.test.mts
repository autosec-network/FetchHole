import { strictEqual } from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import { MemoryCache } from '../dist/cache/memoryCache.mjs';

/**
 * Class representing a generator for random responses.
 * This class provides static methods to generate random strings and JSON objects, and uses these methods to create a response in either plain string or JSON format.
 */
class RandomResponseGenerator {
	/**
	 * Generates a random hexadecimal string of a specified length.
	 * @param {number} length - The length of the random string to generate.
	 * @returns {string} A random hexadecimal string.
	 */
	private static generateRandomString(length: number): string {
		return randomBytes(length).toString('hex');
	}

	/**
	 * Generates a random key name of a specified length.
	 *
	 * @param {number} length - The length of the key name to generate.
	 * @returns {string} A random key name.
	 */
	public static generateRandomKey(length: number): string {
		// Generating a key that is readable and valid for a JSON object
		return this.generateRandomString(length).substring(0, length);
	}

	/**
	 * Generates a random JSON object with multiple properties and possible nested objects.
	 *
	 * @param {number} totalLength - The total length of all random strings to be generated.
	 * @param {number} [maxDepth=1000] - The maximum depth of nesting.
	 * @param {number} currentDepth - The current depth in the recursive calls.
	 * @returns {{ [key: string]: any }} A JSON object with multiple random string properties and possible nested objects.
	 */
	public static generateRandomJson(totalLength: number, maxDepth: number = 1000, currentDepth: number = 0): Record<string, any> {
		const jsonObject: Record<string, any> = {};
		let remainingLength = totalLength;

		while (remainingLength > 0 && currentDepth < maxDepth) {
			const isNested = Math.random() < 0.5; // 50% chance to create a nested object
			const keyLength = Math.min(remainingLength, Math.floor(Math.random() * 10) + 1);
			const valueLength = isNested ? Math.floor(Math.random() * (remainingLength - keyLength)) + 1 : Math.min(remainingLength - keyLength, Math.floor(Math.random() * (remainingLength - keyLength)) + 1);

			const key = this.generateRandomKey(keyLength);
			if (isNested) {
				jsonObject[key] = this.generateRandomJson(valueLength, maxDepth, currentDepth + 1);
			} else {
				jsonObject[key] = this.generateRandomString(valueLength);
			}

			remainingLength -= keyLength + valueLength;
		}

		// Fallback for the last level to ensure it's not an empty object
		if (currentDepth === maxDepth && Object.keys(jsonObject).length === 0 && totalLength > 0) {
			const key = this.generateRandomKey(Math.min(10, totalLength));
			jsonObject[key] = this.generateRandomString(totalLength - key.length);
		}

		return jsonObject;
	}

	/**
	 * Creates a response with either a random string or a JSON object containing a random string.
	 * @param {number} [length=randomInt(1, 1 * 1000 * 1000)] - The length of the random string to be generated, defaulting to a value between 1 byte and 1 megabyte (1 * 1000 * 1000 bytes).
	 * @param {boolean} [asJson=Boolean(randomBytes(1)[0] % 2)] - Flag to determine if the response should be in JSON format.
	 * @returns {Response} A Response object containing either a random string or a JSON object.
	 */
	public static createResponse(length: number = randomInt(1, 1 * 1000 * 1000), asJson: boolean = Boolean(randomBytes(1)[0]! % 2)): Response {
		const content = asJson ? JSON.stringify(this.generateRandomJson(length)) : this.generateRandomString(length);
		// Assuming Response is a class from your web framework
		return new Response(content);
	}
}

describe('MemoryCache Tests', () => {
	let memoryCache: MemoryCache;

	beforeEach(() => {
		memoryCache = new MemoryCache();
	});

	it('should add and retrieve items from cache', async () => {
		const request = new Request('http://example.com');
		const response = RandomResponseGenerator.createResponse();

		await memoryCache.put(request, response);
		const cachedResponse = await memoryCache.match(request);

		// Check if the response we get back is the same as what we put in.
		// strictEqual(await cachedResponse?.text(), await response.text(), 'Cached response should match the original response');
		strictEqual(...(await Promise.all([cachedResponse?.text(), response.text()])), 'Cached response should match the original response');
	});

	it('(LIVE) should add and retrieve items from cache', async () => {
		const request = new Request(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/README.md'));
		const response = await fetch(request);

		await memoryCache.put(request, response);
		const cachedResponse = await memoryCache.match(request);

		// Check if the response we get back is the same as what we put in.
		strictEqual(...(await Promise.all([cachedResponse?.text(), response.text()])), 'Cached response should match the original response');
	});

	it('should not retrieve non-matching items from cache', async () => {
		const request1 = new Request('http://example.com');
		const request2 = new Request('http://example2.com');
		const response = RandomResponseGenerator.createResponse();

		await memoryCache.put(request1, response);

		const cachedResponse = await memoryCache.match(request2);

		strictEqual(cachedResponse, undefined, 'Non-matching request should not retrieve a response');
	});

	it('(LIVE) should not retrieve non-matching items from cache', async () => {
		const request1 = new Request(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/README.md'));
		const request2 = new Request(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/LICENSE'));
		const response = await fetch(request1);

		await memoryCache.put(request1, response);

		const cachedResponse = await memoryCache.match(request2);

		strictEqual(cachedResponse, undefined, 'Non-matching request should not retrieve a response');
	});

	it('should delete items from cache', async () => {
		const request = new Request('http://example.com');
		const response = RandomResponseGenerator.createResponse();

		await memoryCache.put(request, response);
		const deleteResult = await memoryCache.delete(request);

		strictEqual(deleteResult, true, 'Response should be deleted');
		const cachedResponse = await memoryCache.match(request);
		strictEqual(cachedResponse, undefined, 'No response should be found after deletion');
	});

	it('(LIVE) should delete items from cache', async () => {
		const request = new Request(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/README.md'));
		const response = await fetch(request);

		await memoryCache.put(request, response);
		const deleteResult = await memoryCache.delete(request);

		strictEqual(deleteResult, true, 'Response should be deleted');
		const cachedResponse = await memoryCache.match(request);
		strictEqual(cachedResponse, undefined, 'No response should be found after deletion');
	});
});
