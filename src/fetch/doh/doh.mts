import { type DohErrorResponse, type DohSuccessfulResponse } from './types.mjs';

export class DohResolver {
	private nameserver_url: URL;

	constructor(nameserver_url: string | URL) {
		this.nameserver_url = new URL(nameserver_url);
	}

	public async query(qName: string, qType: string | number = 'A', qDo: string | number | boolean = false, qCd: string | number | boolean = false, timeout: number = 10 * 1000): Promise<DohSuccessfulResponse | DohErrorResponse> {
		const response = await this.sendDohMsg('GET', timeout, this.makeGetQuery(this.nameserver_url, qName, qType, qDo, qCd));
		return response.json();
	}

	private makeGetQuery(url: URL, qName: string, qType: string | number = 'A', qDo: string | number | boolean = false, qCd: string | number | boolean = false): URL {
		url.searchParams.set('name', qName);
		url.searchParams.set('type', qType.toString());
		url.searchParams.set('do', qDo.toString());
		url.searchParams.set('cd', qCd.toString());

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
