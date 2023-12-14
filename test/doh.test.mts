import { ok, strictEqual } from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DohResolver } from '../dist/fetch/doh/doh.mjs';
import type { DohRequest } from '../src/fetch/doh/types.d.ts';

describe('DohResolver Tests', () => {
	const resolversToCheck: Record<string, NonNullable<DohRequest['ct']>>[] = [
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
		{
			'https://dns.quad9.net/dns-query': 'application/dns-message',
		},
	];

	for (const resolverRecord of resolversToCheck) {
		for (const [resolverURL, ct] of Object.entries(resolverRecord)) {
			let dohResolver: DohResolver;

			describe(`Tests with resolver ${resolverURL} using ${ct}`, () => {
				beforeEach(() => {
					dohResolver = new DohResolver(resolverURL);
				});

				const queriesToCheck: Map<string, NonNullable<DohRequest['type']>> = new Map([
					['github.com', 'A'],
					['microsoft.com', 'AAAA'],
					[DohResolver.getReverseIpv4('8.8.8.8'), 'PTR'],
					[DohResolver.getReverseIpv6('2001:4860:4860::8888'), 'PTR'],
				]);

				for (const [name, type] of queriesToCheck.entries()) {
					it(`Getting ${type} for ${name}`, async () => {
						const response = await dohResolver.query({ name, type, ct });

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
						if (response.Authority) {
							ok(Array.isArray(response.Authority));
							for (const authority of response.Authority) {
								strictEqual(typeof authority.name, 'string');
								ok(['string', 'number'].includes(typeof authority.type));
								strictEqual(typeof authority.TTL, 'number');
								strictEqual(typeof authority.data, 'string');
							}
						}
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
				}
			});
		}
	}
});
