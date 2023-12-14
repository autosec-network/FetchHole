import { type CacheType, type LoggingLevel } from './config.mjs';
import { type JsonEventStreamParser, type TextEventStreamParser } from './eventStreamParser.mjs';

/**
 * An extension of the Response interface that includes event emitters for streaming text and JSON data.
 * @description This interface is intended for use with Server-Sent Events (SSE) responses.
 *
 * @export
 * @interface StreamableResponse
 *
 * @extends {Response}
 *
 * @property {TextEventStreamParser} [textEvents] - An optional EventEmitter for streaming text data.
 * @property {JsonEventStreamParser} [jsonEvents] - An optional EventEmitter for streaming JSON data.
 */
export interface StreamableResponse extends Response {
	textEvents?: TextEventStreamParser;
	jsonEvents?: JsonEventStreamParser;
}

/**
 * Main FetchHole configuration shape.
 */
export interface FetchHoleConfig {
	cacheType: CacheType;
	/**
	 * @see `openssl list -digest-algorithms`
	 */
	hashAlgorithm: Parameters<typeof createHash>[0];
	hardFail: boolean;
	logLevel: LoggingLevel;
	redirectCount: number;
}

/**
 * Combined `fetch` configuration which includes a `fetchHole` property.
 */
export interface FetchHoleFetchConfig extends RequestInit {
	fetchHole?: Partial<FetchHoleConfig>;
}

interface StreamChunkEvents {
	end: [];
}

export interface textStreamChunkEvents extends StreamChunkEvents, Record<string, [chunk: string]> {}

export interface jsonStreamChunkEvents extends StreamChunkEvents, Record<string, [chunk: Record<string, any> | Record<string, any>[]]> {}
