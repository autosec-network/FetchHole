import { Chalk } from 'chalk';
import { MemoryCache } from '../cache/memoryCache.mjs';
import { CacheType, LoggingLevel, defaultConfig } from './config.mjs';
import { JsonEventStreamParser, TextEventStreamParser } from './eventStreamParser.mjs';
import type { FetchHoleConfig, FetchHoleFetchConfig, StreamableResponse } from './types.js';

const chalk = new Chalk({ level: 1 });

export class FetchHole {
	protected memCache = new MemoryCache();
	// protected diskCache?: CacheStorage;

	/** Effective configuration. */
	protected config: FetchHoleConfig;

	constructor(config: Partial<FetchHoleConfig> = {}) {
		this.config = {
			...defaultConfig,
			...config,
		};
	}

	protected configForCall(overrides: Partial<FetchHoleConfig> | FetchHoleFetchConfig = {}): FetchHoleConfig {
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

	protected logWriter(level: LoggingLevel, info: any[], verbose?: any[], debug?: any[]) {
		if (level > LoggingLevel.OFF) {
			let callable = console.info;
			if (level > LoggingLevel.INFO) {
				callable = console.debug;
			}
			const args = [...info, ...(verbose || []), ...(debug || [])];
			callable.apply(console, args);
		}
	}

	/**
	 * Removes the `body` property from a RequestInit object to reduce verbosity when logging.
	 *
	 * @protected
	 * @param {FetchHoleFetchConfig} [init={}] - The RequestInit object from which to remove the 'body' property. If not provided, an empty object will be used.
	 *
	 * @returns {FetchHoleFetchConfig} The updated RequestInit object without the 'body' property.
	 */
	protected initBodyTrimmer(init: FetchHoleFetchConfig): FetchHoleFetchConfig {
		const config = this.configForCall(init);

		if (config.logLevel < LoggingLevel.DEBUG) {
			if ('cf' in init) {
				delete init['cf'];
			}
			delete init['body'];
		}

		return init;
	}

	/**
	 * Asynchronously logs detailed information about a response, excluding its body to prevent log spam.
	 *
	 * @protected
	 * @param {Response} response - The response to log.
	 *
	 * @returns {Promise<void>} A Promise that resolves when the logging is complete.
	 */
	protected async responseLogging(level: LoggingLevel, response: Response, url?: RequestInfo | URL): Promise<void> {
		const responseInfo: Record<string, any> = {
			headers: Object.fromEntries(response.headers.entries()),
			status: response.status,
			statusText: response.statusText,
			ok: response.ok,
			type: response.type,
		};
		if (level == LoggingLevel.DEBUG) {
			try {
				responseInfo.body = await response.clone().formData();
			} catch (error) {
				try {
					responseInfo.body = await response.clone().json();
				} catch (error) {
					try {
						responseInfo.body = await response.clone().text();
					} catch (error) {
						responseInfo.body = 'Body is not text-parseable';
					}
				}
			}
		}

		this.logWriter(level, [response.ok ? chalk.green('Fetch response') : chalk.red('Fetch response'), response.ok], [response.ok ? chalk.green(response.url || url?.toString()) : chalk.red(response.url || url?.toString()), JSON.stringify(responseInfo, null, '\t')]);
	}

	protected getFresh(destination: Parameters<typeof this.fetch>[0], config: FetchHoleConfig, customRequest: Request, initToSend: RequestInit) {
		return new Promise<StreamableResponse>((resolve, reject) => {
			if (config.cacheType != CacheType.Default) {
				this.logWriter(config.logLevel, [chalk.yellow(`${config.cacheType} Cache missed`)], [customRequest.url]);
			}

			fetch(customRequest, initToSend)
				.then(async (response: StreamableResponse) => {
					if (response.ok) {
						// Append missing headers
						if (response?.headers.has('content-type') && !(response.headers.get('content-type')?.includes('stream') || response.headers.get('content-type')?.includes('multipart'))) {
							// TODO: Generate Content-Length
							// TODO: Generate ETag
						}

						// TODO: Save to cache

						resolve(response);
					} else if ([301, 302, 303, 307, 308].includes(response.status)) {
						// TODO: Redirect
						// https://fetch.spec.whatwg.org/#http-redirect-fetch
					} else {
						await this.responseLogging(config.logLevel, response!, customRequest.url);

						if (config.hardFail) {
							let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
							if (config.logLevel > LoggingLevel.INFO) {
								errorMsg += ` for ${destination}`;
							}
							reject(new Error(errorMsg));
						} else {
							this.logWriter(config.logLevel, [chalk.red(`HTTP ${response.status}: ${response.statusText}`)], [destination]);
							resolve(response);
						}
					}
				})
				.catch(reject);
		});
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
	public async fetch(destination: RequestInfo | URL, init?: FetchHoleFetchConfig, redirectCount: number = 0): Promise<StreamableResponse> {
		return new Promise<StreamableResponse>(async (mainResolve, mainReject) => {
			const config = this.configForCall(init);

			const initToSend: RequestInit = {
				...{
					...init,
					...{
						fetchHole: config,
					},
				},
				...{
					redirect: config.redirectCount <= 0 ? 'error' : redirectCount == Number(config.redirectCount) ? 'error' : 'manual',
				},
			};
			const customRequest = new Request(destination, initToSend);
			let response: StreamableResponse | undefined;

			this.logWriter(config.logLevel, [chalk.magenta('Fetch Request')], [chalk.magenta(customRequest.url)], [JSON.stringify(this.initBodyTrimmer(init || {}), null, '\t')]);

			// Attempt cache
			switch (config.cacheType) {
				case CacheType.Memory:
					try {
						response = (await this.memCache.match(customRequest)) as StreamableResponse | undefined;
					} catch (error) {
						this.logWriter(config.logLevel, [chalk.red(`${config.cacheType} Cache error`)], [error]);
					}

					break;
				// TODO Disk
			}

			if (response) {
				// Good cache
				this.logWriter(config.logLevel, [chalk.green(`${config.cacheType} Cache hit`)], [customRequest.url]);
			} else {
				// No cache found at all
				try {
					response = await this.getFresh(destination, config, customRequest, initToSend);
				} catch (error) {
					mainReject(error);
				}
			}

			await this.responseLogging(config.logLevel, response!, customRequest.url);

			let processTextEventStream = false;
			if (response?.headers.has('content-type') && response.headers.get('content-type') === 'text/event-stream') {
				response.jsonEvents = new JsonEventStreamParser();
				response.textEvents = new TextEventStreamParser();

				processTextEventStream = true;
			}

			mainResolve(response!);

			if (processTextEventStream) {
				// TODO: Streaming support
				new Promise<void>(async (resolve, reject) => {
					try {
						let accumulatedData = '';
						// @ts-ignore
						for await (const chunk of response!.body!) {
							const decodedChunk = new TextDecoder('utf-8').decode(chunk, { stream: true });
							accumulatedData += decodedChunk;

							let newlineIndex;
							while ((newlineIndex = accumulatedData.indexOf('\n')) >= 0) {
								// Found a newline
								const line = accumulatedData.slice(0, newlineIndex).trim();
								accumulatedData = accumulatedData.slice(newlineIndex + 1); // Remove the processed line from the accumulated data

								const colonIndex = line.indexOf(':');
								if (colonIndex !== -1) {
									const eventName = line.substring(0, colonIndex).trim();
									const eventData = line.substring(colonIndex + 1).trim();

									// Process and emit the event
									if (eventName && eventData) {
										try {
											// See if it's JSON
											const decodedJson = JSON.parse(eventData);
											// Return JSON
											response!.jsonEvents?.emit(eventName, decodedJson);
										} catch (error) {
											// Not valid JSON - just ignore and move on
										} finally {
											// Return string
											response!.textEvents?.emit(eventName, eventData);
										}
									}
								}
							}
						}
					} catch (error) {
						reject(error);
					} finally {
						response!.jsonEvents?.emit('end');
						response!.textEvents?.emit('end');
						resolve();
					}
				});
			}
		});
	}
}
