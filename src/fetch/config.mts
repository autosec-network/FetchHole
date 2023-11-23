import { FetchHoleConfig } from './types.js';

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
	redirectCount: 20,
	logLevel: LoggingLevel.INFO,
} satisfies FetchHoleConfig;
