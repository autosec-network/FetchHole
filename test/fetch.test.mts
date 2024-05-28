import { fail, match, strictEqual } from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';
import { CacheType, FetchHole, LoggingLevel } from '../dist/index.mjs';

describe('Fetch Tests', () => {
	let fetchHole: FetchHole;

	beforeEach(() => {
		fetchHole = new FetchHole();
	});

	it('0 redirect - expect any redirect', async () => {
		const response = await fetchHole.fetch('https://debug.demosjarco.workers.dev', {
			fetchHole: {
				logLevel: LoggingLevel.INFO,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	it('0 redirect - expect 0 redirect', async () => {
		const response = await fetchHole.fetch('https://debug.demosjarco.workers.dev', {
			fetchHole: {
				logLevel: LoggingLevel.INFO,
				redirectCount: 0,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	// Same url, but with a redirect

	it('1 redirect - expect any redirect', async () => {
		const response = await fetchHole.fetch('https://tinyurl.com/mtyrsvr', {
			fetchHole: {
				logLevel: LoggingLevel.INFO,
				// Something about async tests doesn't set this back to default
				redirectCount: undefined,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	it('1 redirect - expect 0 redirect', async () => {
		try {
			await fetchHole.fetch('https://tinyurl.com/mtyrsvr', {
				fetchHole: {
					logLevel: LoggingLevel.INFO,
					redirectCount: 0,
				},
			});
			fail('Expected an error, but none was thrown');
		} catch (error) {
			if (error instanceof Error && error.cause) {
				match(error.cause.toString(), /unexpected redirect/);
			} else {
				fail(`${error}`);
			}
		}
	});

	it('should fetch first, then load from memory cache successfully', async () => {
		const response1 = await fetchHole.fetch(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/README.md'), {
			fetchHole: {
				cache: {
					type: CacheType.Memory,
				},
				logLevel: LoggingLevel.INFO,
			},
		});
		const response2 = await fetchHole.fetch(new URL('https://raw.githubusercontent.com/autosec-network/FetchHole/latest/README.md'), {
			fetchHole: {
				cache: {
					type: CacheType.Memory,
				},
				logLevel: LoggingLevel.INFO,
			},
		});

		// @ts-ignore
		strictEqual(...(await Promise.all([response1.text(), response2.text()])), 'Cached response should match the original response');

		strictEqual(response1.headers.has('X-FetchHole-Cache-Status'), false, "First fetch shouldn't have header");
		strictEqual(response2.headers.get('X-FetchHole-Cache-Status'), `HIT-${CacheType.Memory}`, 'Second fetch should have header showing it was cached and from where');
	});
});

after(
	() => {
		process.exit();
	},
	{ timeout: 1 * 60 * 1000 },
);
