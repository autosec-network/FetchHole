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

	private async sendDohMsg(method: 'GET' | 'POST', ct: ExcludeUndefined<DohRequest['ct']>, timeout: number, url: URL, body?: ArrayBuffer): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		const headers = new Headers();
		headers.set('Content-Type', ct);
		headers.set('Accept', ct);

		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: body ? new Blob([body]) : undefined,
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
