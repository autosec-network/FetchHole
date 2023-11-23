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
