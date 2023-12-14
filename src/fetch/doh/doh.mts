import { CHECKING_DISABLED, decode, encode, type Answer, type DecodedPacket, type Packet, type Question } from 'dns-packet';
import { Buffer } from 'node:buffer';
import { randomInt } from 'node:crypto';
import type { DohErrorResponse, DohRequest, DohSuccessfulResponse, ExcludeUndefined, ResponseValues } from './types.js';

// @ts-ignore
import { DNSSEC_OK } from 'dns-packet';
// https://github.com/mafintosh/dns-packet/blob/master/index.js#L1655 It is exported, but the type doesn't show it. Tracked: https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/67884

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

	private getRandomInt(min: number, max: number) {
		return new Promise<number>((resolve, reject) =>
			// The +1 is added to max in the randomInt call because the upper bound is exclusive
			randomInt(min, max + 1, (err, value) => {
				if (err) {
					reject(err);
				} else {
					resolve(value);
				}
			}),
		);
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
				const question: Packet = {
					type: 'query',
					flags: 0,
					questions: [
						{
							type: parameters.type || 'A',
							name: parameters.name,
						},
					],
				};

				if (question.flags) {
					if ('cd' in parameters && Boolean(parameters.cd)) question.flags |= CHECKING_DISABLED;
					if ('do' in parameters && Boolean(parameters.do)) question.flags |= DNSSEC_OK;
				}

				if (parameters.random_padding) {
					question.id = await this.getRandomInt(1, 65534);
				}

				const response = await this.sendDohMsg('POST', parameters.ct, timeout, this.nameserver_url, encode(question));
				return this.parseDnsMessage(decode(Buffer.from(await response.arrayBuffer())));
			}
			case 'application/dns-json': {
				const response = await this.sendDohMsg('GET', parameters.ct, timeout, this.makeJsonGetQuery(this.nameserver_url, parameters));
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

	private mapResponseValues(record: Answer | Question): ResponseValues {
		return {
			name: record.name,
			type: record.type,
			// @ts-ignore
			TTL: record.TTL ?? 0,
			// @ts-ignore
			data: record.data ?? '',
		};
	}

	private parseDnsMessage(packet: DecodedPacket): DohSuccessfulResponse {
		return {
			Status: packet.flags ?? 0, // Assuming flags field contains the response code
			TC: packet.flag_tc,
			RD: packet.flag_rd,
			RA: packet.flag_ra,
			AD: packet.flag_ad,
			CD: packet.flag_cd,
			Question:
				packet.questions?.map((question) => ({
					name: question.name,
					type: question.type,
				})) ?? [],
			Answer: packet.answers?.map((answer) => this.mapResponseValues(answer)) ?? [],
			Authority: packet.authorities?.map((authority) => this.mapResponseValues(authority)) ?? [],
			Additional: packet.additionals?.map((additional) => this.mapResponseValues(additional)) ?? [],
		};
	}

	private async sendDohMsg(method: 'GET' | 'POST', ct: ExcludeUndefined<DohRequest['ct']>, timeout: number, url: URL, body?: Buffer): Promise<Response> {
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
