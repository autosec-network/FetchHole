import { strictEqual } from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { beforeEach, describe, it } from 'node:test';
import { MemoryCache } from '../src/memoryCache.mjs';

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
	private static generateRandomKey(length: number): string {
		// Generating a key that is readable and valid for a JSON object
		return this.generateRandomString(length).substring(0, length);
	}

	private static generateRandomJson(totalLength: number): Record<string, string> {
		const jsonObject: Record<string, string> = {};
		let remainingLength = totalLength;

		while (remainingLength > 0) {
			// Ensuring the key and value have a minimum length of 1
			const keyLength = Math.min(remainingLength, Math.floor(Math.random() * 10) + 1);
			const valueLength = Math.min(remainingLength - keyLength, Math.floor(Math.random() * (remainingLength - keyLength)) + 1);

			const key = this.generateRandomKey(keyLength);
			jsonObject[key] = this.generateRandomString(valueLength);

			remainingLength -= keyLength + valueLength;
		}

		return jsonObject;
	}

	/**
	 * Creates a response with either a random string or a JSON object containing a random string.
	 * @param {number} [length=randomInt(1, 1 * 1000 * 1000)] - The length of the random string to be generated, defaulting to a value between 1 byte and 1 megabyte (1 * 1000 * 1000 bytes).
	 * @param {boolean} [asJson=Boolean(randomBytes(1)[0] % 2)] - Flag to determine if the response should be in JSON format.
	 * @returns {Response} A Response object containing either a random string or a JSON object.
	 */
	public static createResponse(length: number = randomInt(1, 1 * 1000 * 1000), asJson: boolean = Boolean(randomBytes(1)[0] % 2)): Response {
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
		// strictEqual(await cachedResponse?.text(), await response.text(), 'Cached response should match the original response');
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
