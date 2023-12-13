import { ok, strictEqual } from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DohResolver } from '../dist/fetch/doh/doh.mjs';

describe('DohResolver Tests', () => {
	const resolversToCheck: Record<string, `${string}/${string}`>[] = [
		{
			'https://dns.google/resolve': 'application/dns-json',
		},
		{
			'https://dns.google/dns-query': 'application/dns-message',
		},
		{
			'https://cloudflare-dns.com/dns-query': 'application/dns-json',
		},
		{
			'https://cloudflare-dns.com/dns-query': 'application/dns-message',
		},
	];

	resolversToCheck.forEach((resolverRecord) => {
		Object.entries(resolverRecord).forEach(([resolverURL, ct]) => {
			let dohResolver: DohResolver;

			describe(`Tests with resolver ${resolverURL} using ${ct}`, () => {
				beforeEach(() => {
					dohResolver = new DohResolver(resolverURL);
				});

				it('should handle valid inputs and return a successful response', async () => {
					const response = await dohResolver.query({ name: 'github.com', ct });

					// Assert that the response contains the required properties of DohSuccessfulResponse
					strictEqual(typeof response.Status, 'number');
					strictEqual(typeof response.TC, 'boolean');
					strictEqual(typeof response.RD, 'boolean');
					strictEqual(typeof response.RA, 'boolean');
					strictEqual(typeof response.AD, 'boolean');
					strictEqual(typeof response.CD, 'boolean');
					ok(Array.isArray(response.Question));
					for (const question of response.Question) {
						strictEqual(typeof question.name, 'string');
						ok(['string', 'number'].includes(typeof question.type));
					}
					if (response.Answer) {
						ok(response.Answer === undefined || Array.isArray(response.Answer));
						for (const answer of response.Answer) {
							strictEqual(typeof answer.name, 'string');
							ok(['string', 'number'].includes(typeof answer.type));
							strictEqual(typeof answer.TTL, 'number');
							strictEqual(typeof answer.data, 'string');
						}
					}
					// if (response.Authority) {
					// 	ok(Array.isArray(response.Authority));
					// 	for (const authority of response.Authority) {
					// 		strictEqual(typeof authority.name, 'string');
					// 		ok(['string', 'number'].includes(typeof authority.type));
					// 		strictEqual(typeof authority.TTL, 'number');
					// 		strictEqual(typeof authority.data, 'string');
					// 	}
					// }
					// if (response.Additional) {
					// 	ok(Array.isArray(response.Additional));
					// 	for (const additional of response.Additional) {
					// 		strictEqual(typeof additional.name, 'string');
					// 		ok(['string', 'number'].includes(typeof additional.type));
					// 		strictEqual(typeof additional.TTL, 'number');
					// 		strictEqual(typeof additional.data, 'string');
					// 	}
					// }
					// if (response.Comment) {
					// 	if (Array.isArray(response.Comment)) {
					// 		for (const c of response.Comment) {
					// 			strictEqual(typeof c, 'string');
					// 		}
					// 	} else {
					// 		strictEqual(typeof response.Comment, 'string');
					// 	}
					// }
				});
			});
		});
	});
});
