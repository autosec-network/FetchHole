import type { DohErrorResponse, DohRequest, DohSuccessfulResponse, ExcludeUndefined } from './types.mjs';

// @ts-expect-error
import { DOHClient } from 'dns2';
// @ts-expect-error
import type { Packet } from 'dns2/packet.js';

export class DohResolver {
	private nameserver_url: URL;

	constructor(nameserver_url: string | URL) {
		this.nameserver_url = new URL(nameserver_url);
	}

	public static getReverseIpv4(ip: `${number}.${number}.${number}.${number}`) {
		const parts = ip.split('.').reverse();
		return parts.join('.') + '.in-addr.arpa';
	}

	public static getReverseIpv6(ip: string) {
		const fullLength = 8;
		const segments = ip.split(':');
		const expandSegments = segments.map((segment) => segment.padStart(4, '0'));
		const missingSegments = fullLength - expandSegments.length;
		const zeroSegments = Array(missingSegments).fill('0000');

		let expanded = [...expandSegments.slice(0, segments.indexOf('')), ...zeroSegments, ...expandSegments.slice(segments.indexOf(''))].join(':');
		expanded = expanded.replace(/:/g, ''); // Remove colons
		let reversed = expanded.split('').reverse().join(''); // Reverse the string
		let dotted = reversed.split('').join('.'); // Insert dots
		return dotted + '.ip6.arpa'; // Append suffix
	}

	// @ts-ignore
	public async query(parameters: DohRequest, timeout: number = 10 * 1000): Promise<DohSuccessfulResponse | DohErrorResponse | undefined> {
		if (!('ct' in parameters)) {
			if (this.nameserver_url.pathname === '/dns-query') {
				parameters.ct = 'application/dns-message';
			} else {
				parameters.ct = 'application/dns-json';
			}
		}

		switch (parameters.ct) {
			case 'application/dns-message': {
				const response = (await DOHClient({
					dns: this.nameserver_url.host,
					get: (url: string) =>
						fetch(url, {
							headers: {
								// https://github.com/song940/node-dns/blob/master/client/doh.js#L5
								accept: 'application/dns-message',
							},
						}).then((response) => response.body),
				})(parameters.name)) as Packet;
				console.log(response.answers);
				return response;
			}
			case 'application/dns-json': {
				const response = await this.sendDohJson('GET', parameters.ct, timeout, this.makeJsonGetQuery(this.nameserver_url, parameters));
				return response.json();
			}
		}
	}

	private makeJsonGetQuery(url: URL, parameters: DohRequest): URL {
		Object.entries(parameters).forEach(([key, value]) => {
			if (value !== undefined) {
				url.searchParams.set(key, value.toString());
			}
		});

		return url;
	}

	private async sendDohJson(method: 'GET' | 'POST', ct: ExcludeUndefined<DohRequest['ct']>, timeout: number, url: URL, body?: ArrayBufferLike): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		const headers = new Headers();
		headers.set('Content-Type', ct);
		headers.set('Accept', ct);

		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: body, // Using Buffer directly
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (response.ok || response.status === 304) {
			return response;
		} else {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	}
}
