import { fail, match, strictEqual } from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { LoggingLevel } from '../dist/fetch/config.mjs';
import { FetchHole } from '../dist/fetch/index.mjs';

describe('Fetch Tests', () => {
	let fetchHole: FetchHole;

	beforeEach(() => {
		fetchHole = new FetchHole();
	});

	it('should fetch data successfully', async () => {
		const response = await fetchHole.fetch('https://debug.demosjarco.workers.dev', {
			fetchHole: {
				logLevel: LoggingLevel.OFF,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	it('should fetch data successfully', async () => {
		const response = await fetchHole.fetch('https://debug.demosjarco.workers.dev', {
			fetchHole: {
				logLevel: LoggingLevel.OFF,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	// Same url, but with a redirect

	it('should fetch data successfully', async () => {
		const response = await fetchHole.fetch('https://tinyurl.com/mtyrsvr', {
			fetchHole: {
				logLevel: LoggingLevel.OFF,
			},
		});
		const json = await response.json();
		strictEqual(typeof JSON.stringify(json), 'string');
	});

	it('should fail to fetch data', async () => {
		try {
			await fetchHole.fetch('https://tinyurl.com/mtyrsvr', {
				fetchHole: {
					logLevel: LoggingLevel.OFF,
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
});
