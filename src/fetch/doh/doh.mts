import type { DohErrorResponse, DohRequest, DohSuccessfulResponse } from './types.js';

export class DohResolver {
	private nameserver_url: URL;

	constructor(nameserver_url: string | URL) {
		this.nameserver_url = new URL(nameserver_url);
	}

	public async query(parameters: DohRequest, timeout: number = 10 * 1000): Promise<DohSuccessfulResponse | DohErrorResponse> {
		const response = await this.sendDohMsg('GET', timeout, this.makeGetQuery(this.nameserver_url, parameters));
		return response.json();
	}

	private makeGetQuery(url: URL, parameters: DohRequest): URL {
		Object.entries(parameters).forEach(([key, value]) => {
			if (value !== undefined) {
				url.searchParams.set(key, value.toString());
			}
		});

		return url;
	}

	/*private makePostQuery(qName: string, qType: string | number = 'A', qDo: string | number | boolean = false, qCd: string | number | boolean = false): DohBodyRequest {
		return {
			name: qName,
			type: qType,
			do: qDo,
			cd: qCd,
		};
	}*/

	// private async sendDohMsg(method: 'GET' | 'POST' = 'GET', timeout: number = 10 * 1000, url: URL = this.nameserver_url, body?: DohBodyRequest): Promise<Response> {
	private async sendDohMsg(method: 'GET' | 'POST' = 'GET', timeout: number = 10 * 1000, url: URL = this.nameserver_url): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		const response = await fetch(url, {
			method: method,
			headers: {
				Accept: 'application/dns-json',
			},
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
