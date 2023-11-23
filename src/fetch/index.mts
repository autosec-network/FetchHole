import { Chalk } from 'chalk';
import { MemoryCache } from '../cache/memoryCache.mjs';
import { CacheType, LoggingLevel, defaultConfig } from './config.mjs';
import type { FetchHoleConfig, FetchHoleFetchConfig, StreamableResponse } from './types.js';

const chalk = new Chalk({ level: 1 });

export class FetchHole {
	private memCache = new MemoryCache();
	// private diskCache?: CacheStorage;

	/** Effective configuration. */
	private config: FetchHoleConfig;

	constructor(config: Partial<FetchHoleConfig> = {}) {
		this.config = {
			...defaultConfig,
			...config,
		};
	}

	private configForCall(overrides: Partial<FetchHoleConfig>): FetchHoleConfig;
	private configForCall(overrides: FetchHoleFetchConfig): FetchHoleConfig;
	private configForCall(overrides: Partial<FetchHoleConfig> | FetchHoleFetchConfig): FetchHoleConfig {
		let fetchHoleConfig: Partial<FetchHoleConfig>;

		if ('fetchHole' in overrides) {
			// Extract fetchHole property if overrides is of type FetchHoleFetchConfig
			fetchHoleConfig = (overrides as FetchHoleFetchConfig).fetchHole || {};
		} else {
			// Use overrides directly if it's of type Partial<FetchHoleConfig>
			fetchHoleConfig = (overrides as Partial<FetchHoleConfig>) || {};
		}

		return {
			...this.config,
			...fetchHoleConfig,
		};
	}

	private logWriter(level: LoggingLevel, info: any[], verbose?: any[], debug?: any[]) {
		let callable = console.info;
		if (level > LoggingLevel.INFO) {
			callable = console.debug;
		}
		const args = [...info, ...(verbose || []), ...(debug || [])];
		callable.apply(console, args);
	}

	/**
	 * Removes the `body` property from a RequestInit object to reduce verbosity when logging.
	 *
	 * @private
	 * @param {FetchHoleFetchConfig} [init={}] - The RequestInit object from which to remove the 'body' property. If not provided, an empty object will be used.
	 *
	 * @returns {FetchHoleFetchConfig} The updated RequestInit object without the 'body' property.
	 */
	private initBodyTrimmer(init?: FetchHoleFetchConfig): FetchHoleConfig {
		const cfg = init?.fetchHole || defaultConfig;
		if (cfg.logLevel < LoggingLevel.DEBUG) {
			delete (cfg as any)['cf'];
			delete (cfg as any)['body'];
		}
		return cfg;
	}

	/**
	 * Asynchronously logs detailed information about a response, excluding its body to prevent log spam.
	 *
	 * @private
	 * @param {Response} response - The response to log.
	 *
	 * @returns {Promise<void>} A Promise that resolves when the logging is complete.
	 */
	private async responseLogging(level: LoggingLevel, response: Response, url?: RequestInfo | URL): Promise<void> {
		let tempHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			tempHeaders[key] = value;
		});

		const responseInfo: Record<string, any> = {
			headers: tempHeaders,
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
			type: response.type,
		};
		if (level == LoggingLevel.DEBUG) {
			responseInfo.body = await response.clone().text();
		}

		this.logWriter(level, [response.ok ? chalk.green('Fetch response') : chalk.red('Fetch response'), response.ok], [response.ok ? chalk.green(response.url || url?.toString()) : chalk.red(response.url || url?.toString()), JSON.stringify(responseInfo, null, '\t')]);
	}

	/**
	 * Fetches a resource at a specified URL, with caching and redirect following features.
	 *
	 * @public
	 * @param {RequestInfo | URL} destination - The URL of the resource to fetch.
	 * @param {FetchHoleFetchConfig} [init] - Optional request initialization settings.
	 * @returns {Promise<StreamableResponse>} A Promise that resolves to the Response from the fetch or cache, or the Response from the final redirect if any redirects were followed.
	 *
	 * @throws {GraphQLError} If an unsafe redirect is encountered (i.e., a redirect to a different origin) and hardFail is set to true, or if the fetch fails for any other reason and hardFail is set to true.
	 */
	public async fetch(destination: RequestInfo | URL, init?: FetchHoleFetchConfig): Promise<StreamableResponse> {
		const config = this.configForCall(init);

		const initToSend: RequestInit = { ...init, ...{ redirect: config.redirectCount <= 0 ? 'error' : 'manual' } };
		const customRequest = new Request(destination, initToSend);
		let response: StreamableResponse | undefined;

		this.logWriter(config.logLevel, [chalk.magenta('Fetch Request')], [chalk.magenta(customRequest.url)], [JSON.stringify(this.initBodyTrimmer(init), null, '\t')]);

		// Attempt cache
		if (init?.fetchHole.cacheType == CacheType.Memory) {
			response = (await this.memCache.match(customRequest)) as StreamableResponse | undefined;
		} else if (init?.fetchHole.cacheType == CacheType.Disk) {
			try {
			} catch (error) {
				this.logWriter(init.fetchHole.logLevel, [chalk.red(`${init?.fetchHole.cacheType} Cache error`)], [error]);
			}
		}

		const getFresh = async () => {
			if (config.cacheType != CacheType.Default) {
				this.logWriter(config.logLevel, [chalk.yellow(`${init?.fetchHole.cacheType} Cache missed`)], [customRequest.url]);
			}
		};

		if (response) {
			// Good cache
			this.logWriter(config.logLevel, [chalk.green(`${config.cacheType} Cache hit`)], [customRequest.url]);
		} else {
			// No cache found at all
			await getFresh();
		}

		await this.responseLogging(config.logLevel, response!, customRequest.url);

		return response!;
	}
}
