import type { createHash } from 'node:crypto';
import type { CacheType, IPBlockMode, LoggingLevel } from './config.mjs';
import type { DohRequest } from './doh/types.mjs';
import type { JsonEventStreamParser, TextEventStreamParser } from './eventStreamParser.mjs';

export type RecursivePartial<T> = {
	[P in keyof T]?: T[P] extends Array<infer U> ? Array<RecursivePartial<U>> : T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

export interface PotentialThirdPartyResponse extends Response, Record<string, any> {}

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
	cache: CacheSettings;
	/**
	 * The server used to run security check.
	 * Specifically it looks for `NXDOMAIN` (domain does not exist) response with an `AUTHORITY` of `0` (the dns provider queries is the one blocking it, not an upstream DNS server)
	 * @default { provider: 'https://dns.quad9.net/dns-query', timeout: 2000 }
	 */
	dohServer: DoHServerConfig;
	/**
	 * If `true`, an error will be thrown and processing will stop.
	 * If `false`, an error will be logged, and processing of that request will stop, but
	 * @default false
	 */
	hardFail: boolean;
	ip: {
		/**
		 * @default IPBlockMode.BlockIfNoPTR
		 */
		policy: IPBlockMode;
		/**
		 * The server used to perform PTR lookups, not security checks.
		 * If a PTR lookup succeedes, the returned domain will still run through the normal security check
		 * @default { provider: 'https://dns.google/dns-query', timeout: 2000 }
		 */
		ptrDohServer: DoHServerConfig;
	};
	/**
	 * @default LoggingLevel.MINIMUM
	 */
	logLevel: LoggingLevel;
	/**
	 * @default 20
	 */
	redirectCount: number;
}
interface CacheSettings extends Required<CacheQueryOptions> {
	/**
	 * @default CacheType.Default
	 */
	type: CacheType;
	/**
	 * @see `openssl list -digest-algorithms`
	 * @default 'sha256'
	 */
	hashAlgorithm: Parameters<typeof createHash>[0];
}
interface DoHServerConfig extends Pick<DohRequest, 'ct'> {
	provider: URL | `https://${string}`;
	/**
	 * Other headers needed by DoH server other than required by RFC 8484
	 * @default undefined
	 */
	extraHeaders: Headers;
	/**
	 * Timeout in milliseconds to wait for a DNS query to resolve
	 * @default 2000
	 */
	timeout: number;
}

/**
 * Combined `fetch` configuration which includes a `fetchHole` property.
 */
export interface FetchHoleFetchConfig extends RequestInit {
	fetchHole?: RecursivePartial<FetchHoleConfig>;
}

interface StreamChunkEvents {
	end: [];
}

export interface textStreamChunkEvents extends StreamChunkEvents, Record<string, [chunk: string] | []> {}

export interface jsonStreamChunkEvents extends StreamChunkEvents, Record<string, [chunk: Record<string, any> | Record<string, any>[]] | []> {}
