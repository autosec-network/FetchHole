// @ts-ignore
import { CHECKING_DISABLED, DNSSEC_OK, decode, encode, type Answer, type DecodedPacket, type Packet, type Question } from 'dns-packet';
import { Buffer } from 'node:buffer';
import { randomInt } from 'node:crypto';
import type { DohRequest, DohSuccessfulResponse, ExcludeUndefined, ResponseValues } from './types.js';

export class DohResolver {
	private nameserver_url: URL;

	constructor(nameserver_url: string | URL) {
		this.nameserver_url = new URL(nameserver_url);
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

	// public async query(parameters: DohRequest, timeout: number = 10 * 1000): Promise<DohSuccessfulResponse | DohErrorResponse> {
	public async query(parameters: DohRequest, timeout: number = 10 * 1000) {
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
					if (parameters.cd) question.flags |= CHECKING_DISABLED;
					if (parameters.do) question.flags |= DNSSEC_OK;
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
