import type { FetchHoleConfig, FetchHoleFetchConfig } from './types.js';

/**
 * Enumerates types of caches which can be set up with FetchHole.
 */
export enum CacheType {
	/**
	 * Bypass any cache and don't save
	 */
	Default = 'Off',
	/**
	 * Save to memory for the life of the worker
	 */
	Memory = 'Memory',
	/**
	 * Save to Web Cache API (available in service workers)
	 */
	Disk = 'Disk',
}

/**
 * Enum representing the possible IP blocking modes.
 */
export enum IPBlockMode {
	/**
	 * Block all requests where the destination is an IP address.
	 */
	BlockAll = 'block',
	/**
	 * Block requests to IP addresses if a PTR (Pointer) record is not found.
	 * Note: If a PTR lookup succeedes, the returned domain will still run through the normal security check
	 * This mode provides a balance between security and flexibility.
	 */
	BlockIfNxPTR = 'ptr',
	/**
	 * Allow all requests, including those to IP addresses.
	 */
	AllowAll = 'allow',
}

/**
 * Supported logging levels.
 */
export enum LoggingLevel {
	/**
	 * Same as `VERBOSE` but includes full body and config object
	 * Note: This will clutter your logs REAL FAST
	 *
	 * Logs when a request happens along with url and full init object
	 * Logs when a response happens along with `.ok` status, url, and response object (including full body)
	 * @example Fetch request https://example.com {"fetchHole":...}}
	 * @example Fetch response true https://example.com {"headers": ...,"body": ...}
	 */
	DEBUG = 4,
	/**
	 * Logs when a request happens along with url and set init object
	 * Logs when a response happens along with `.ok` status, url, and response object
	 * @example Fetch request https://example.com {"fetchHole":{...}}
	 * @example Fetch response true https://example.com {"headers":{...}}
	 */
	VERBOSE = 3,
	/**
	 * Logs when a request happens along with url
	 * Logs when a response happens along with `.ok` status and url
	 * @example Fetch request https://example.com
	 * @example Fetch response true https://example.com
	 */
	INFO = 2,
	/**
	 * Logs when a request happens
	 * Logs when a response happens along with `.ok` status
	 * @example Fetch request
	 * @example Fetch response true
	 */
	MINIMUM = 1,
	OFF = 0,
}

/**
 * Default configuration.
 */
export const defaultConfig = {
	cache: {
		type: CacheType.Default,
		hashAlgorithm: 'sha256',
		ignoreMethod: false,
		ignoreSearch: false,
		ignoreVary: false,
	},
	dohServer: {
		provider: 'https://dns.quad9.net/dns-query',
		extraHeaders: new Headers(),
		timeout: 2 * 1000,
	},
	hardFail: true,
	ip: {
		policy: IPBlockMode.BlockIfNxPTR,
		ptrDohServer: {
			provider: 'https://dns.google/dns-query',
			extraHeaders: new Headers(),
			timeout: 2 * 1000,
		},
	},
	logLevel: LoggingLevel.MINIMUM,
	redirectCount: 20,
} satisfies FetchHoleConfig;

export function configForCall(overrides: Partial<FetchHoleConfig> | FetchHoleFetchConfig = {}, initialConfig: FetchHoleConfig = defaultConfig): FetchHoleConfig {
	let fetchHoleConfig: Partial<FetchHoleConfig>;

	if ('fetchHole' in overrides) {
		// Extract fetchHole property if overrides is of type FetchHoleFetchConfig
		fetchHoleConfig = (overrides as FetchHoleFetchConfig).fetchHole || {};
	} else {
		// Use overrides directly if it's of type Partial<FetchHoleConfig>
		fetchHoleConfig = (overrides as Partial<FetchHoleConfig>) || {};
	}

	return deepMerge(initialConfig, fetchHoleConfig);
}
function deepMerge(target: any, source: any): any {
	if (!source) {
		return target;
	}

	for (const key in source) {
		if (source[key] && typeof source[key] === 'object') {
			if (!target[key]) {
				Object.assign(target, { [key]: {} });
			}
			deepMerge(target[key], source[key]);
		} else {
			Object.assign(target, { [key]: source[key] });
		}
	}

	return target;
}
