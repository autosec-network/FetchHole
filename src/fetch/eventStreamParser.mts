import { EventEmitter } from 'node:stream';
import type { jsonStreamChunkEvents, textStreamChunkEvents } from './types.js';

export class TextEventStreamParser extends EventEmitter {
	// @ts-ignore
	public emit<K extends keyof textStreamChunkEvents>(event: K, ...args: textStreamChunkEvents[K]): boolean {
		return super.emit(event as string, ...args);
	}
	// @ts-ignore
	public once<K extends keyof textStreamChunkEvents>(event: K, listener: (...args: textStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.once(event as string, listener);
	}
	// @ts-ignore
	public on<K extends keyof textStreamChunkEvents>(event: K, listener: (...args: textStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.on(event as string, listener);
	}
	// @ts-ignore
	public off<K extends keyof textStreamChunkEvents>(event: K, listener: (...args: textStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.off(event as string, listener);
	}
}

export class JsonEventStreamParser extends EventEmitter {
	// @ts-ignore
	public emit<K extends keyof jsonStreamChunkEvents>(event: K, ...args: jsonStreamChunkEvents[K]): boolean {
		return super.emit(event as string, ...args);
	}
	// @ts-ignore
	public once<K extends keyof jsonStreamChunkEvents>(event: K, listener: (...args: jsonStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.once(event as string, listener);
	}
	// @ts-ignore
	public on<K extends keyof jsonStreamChunkEvents>(event: K, listener: (...args: jsonStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.on(event as string, listener);
	}
	// @ts-ignore
	public off<K extends keyof jsonStreamChunkEvents>(event: K, listener: (...args: jsonStreamChunkEvents[K]) => void): this {
		// @ts-ignore
		return super.off(event as string, listener);
	}
}
