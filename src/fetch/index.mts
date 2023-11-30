import { Chalk } from 'chalk';
import { MemoryCache } from '../cache/memoryCache.mjs';
import { CacheType, LoggingLevel, defaultConfig } from './config.mjs';
import { JsonEventStreamParser, TextEventStreamParser } from './eventStreamParser.mjs';
import type { FetchHoleConfig, FetchHoleFetchConfig, StreamableResponse } from './types.js';

const chalk = new Chalk({ level: 1 });

export class FetchHole {
	private memCache = new MemoryCache();
	// private diskCache?: CacheStorage;

	/** Effective configuration. */
	private config: FetchHoleConfig;

	constructor(config: Partial<FetchHoleConfig> = {}) {
		this.config = {
			...defaultConfig,
			...config,
		};
	}

	private configForCall(overrides: Partial<FetchHoleConfig> | FetchHoleFetchConfig = {}): FetchHoleConfig {
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

	private logWriter(level: LoggingLevel, info: any[], verbose?: any[], debug?: any[]) {
		let callable = console.info;
		if (level > LoggingLevel.INFO) {
			callable = console.debug;
		}
		const args = [...info, ...(verbose || []), ...(debug || [])];
		callable.apply(console, args);
	}

	/**
	 * Removes the `body` property from a RequestInit object to reduce verbosity when logging.
	 *
	 * @private
	 * @param {FetchHoleFetchConfig} [init={}] - The RequestInit object from which to remove the 'body' property. If not provided, an empty object will be used.
	 *
	 * @returns {FetchHoleFetchConfig} The updated RequestInit object without the 'body' property.
	 */
	private initBodyTrimmer(init: FetchHoleFetchConfig): FetchHoleFetchConfig {
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
	 * @private
	 * @param {Response} response - The response to log.
	 *
	 * @returns {Promise<void>} A Promise that resolves when the logging is complete.
	 */
	private async responseLogging(level: LoggingLevel, response: Response, url?: RequestInfo | URL): Promise<void> {
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
					responseInfo.body = await response.clone().text();
				}
			}
		}

		this.logWriter(level, [response.ok ? chalk.green('Fetch response') : chalk.red('Fetch response'), response.ok], [response.ok ? chalk.green(response.url || url?.toString()) : chalk.red(response.url || url?.toString()), JSON.stringify(responseInfo, null, '\t')]);
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

			const getFresh = () => {
				return new Promise<void>((resolve, reject) => {
					if (config.cacheType != CacheType.Default) {
						this.logWriter(config.logLevel, [chalk.yellow(`${config.cacheType} Cache missed`)], [customRequest.url]);
					}

					fetch(customRequest, initToSend)
						.then(async (incomingResponse: StreamableResponse) => {
							if (incomingResponse.ok) {
								// Append missing headers
								if (incomingResponse?.headers.has('content-type') && !(incomingResponse.headers.get('content-type')?.includes('stream') || incomingResponse.headers.get('content-type')?.includes('multipart'))) {
									// TODO: Generate Content-Length
									// TODO: Generate ETag
								}

								// TODO: Save to cache

								response = incomingResponse;
							} else if ([301, 302, 303, 307, 308].includes(incomingResponse.status)) {
								// TODO: Redirect
								// https://fetch.spec.whatwg.org/#http-redirect-fetch
							} else {
								await this.responseLogging(config.logLevel, incomingResponse!, customRequest.url);

								if (config.hardFail) {
									let errorMsg = `HTTP ${incomingResponse.status}: ${incomingResponse.statusText}`;
									if (config.logLevel > LoggingLevel.INFO) {
										errorMsg += ` for ${destination}`;
									}
									reject(new Error(errorMsg));
								} else {
									this.logWriter(config.logLevel, [chalk.red(`HTTP ${incomingResponse.status}: ${incomingResponse.statusText}`)], [destination]);
									resolve();
								}
							}
							resolve();
						})
						.catch(reject);
				});
			};

			if (response) {
				// Good cache
				this.logWriter(config.logLevel, [chalk.green(`${config.cacheType} Cache hit`)], [customRequest.url]);
			} else {
				// No cache found at all
				try {
					await getFresh();
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
