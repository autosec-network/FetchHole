import { EventEmitter } from 'node:events';

/**
 * An extension of the Response interface that includes event emitters for streaming text and JSON data.
 * @description This interface is intended for use with Server-Sent Events (SSE) responses.
 *
 * @export
 * @interface StreamableResponse
 *
 * @extends {Response}
 *
 * @property {EventEmitter} [textEvents] - An optional EventEmitter for streaming text data.
 * @property {EventEmitter} [jsonEvents] - An optional EventEmitter for streaming JSON data.
 */
export interface StreamableResponse extends Response {
	textEvents?: EventEmitter;
	jsonEvents?: EventEmitter;
}

/**
 * Main FetchHole configuration shape.
 */
export interface FetchHoleConfig {
	cacheType: CacheType;
	redirectCount: number;
	logLevel: LoggingLevel;
}

/**
 * Combined `fetch` configuration which includes a `fetchHole` property.
 */
export interface FetchHoleFetchConfig extends RequestInit {
	fetchHole: FetchHoleConfig;
}
