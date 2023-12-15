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
 * Supported logging levels.
 */
export enum LoggingLevel {
	DEBUG = 3,
	VERBOSE = 2,
	INFO = 1,
	OFF = 0,
}

/**
 * Default configuration.
 */
export const defaultConfig = {
	cacheType: CacheType.Default,
	hashAlgorithm: 'sha256',
	hardFail: true,
	logLevel: LoggingLevel.INFO,
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
