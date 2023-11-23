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
	hardFail: boolean;
	logLevel: LoggingLevel;
	redirectCount: number;
}

/**
 * Combined `fetch` configuration which includes a `fetchHole` property.
 */
export interface FetchHoleFetchConfig extends RequestInit {
	fetchHole?: FetchHoleConfig;
}

interface StreamChunkEvents {
	end: [];
}

export interface textStreamChunkEvents extends Record<string, [chunk: string]>, StreamChunkEvents {}

export interface jsonStreamChunkEvents extends Record<string, [chunk: Record<string, any> | Record<string, any>[]]>, StreamChunkEvents {}
