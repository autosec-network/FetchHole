import { Chalk } from 'chalk';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { MemoryCache } from '../cache/memoryCache.mjs';
import { CacheType, LoggingLevel, defaultConfig } from './config.mjs';
import { JsonEventStreamParser, TextEventStreamParser } from './eventStreamParser.mjs';
import { dropAuthRedirect, modifyRedirectRequest, responseTainted } from './extras.mjs';
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
				responseInfo['body'] = Object.fromEntries((await response.clone().formData()).entries());
			} catch (error) {
				try {
					responseInfo['body'] = await response.clone().json();
				} catch (error) {
					try {
						responseInfo['body'] = await response.clone().text();
					} catch (error) {
						responseInfo['body'] = 'Body is not text-parseable';
					}
				}
			}
		}

		this.logWriter(level, [response.ok ? chalk.green('Fetch response') : chalk.red('Fetch response'), response.ok], [response.ok ? chalk.green(response.url || url?.toString()) : chalk.red(response.url || url?.toString()), JSON.stringify(responseInfo, null, '\t')]);
	}

	/**
	 * Processes the headers of a response.
	 * This method checks for the presence of 'Content-Length' and 'ETag' headers.
	 * If these headers are missing, it calculates their values.
	 * Optimized to work in chunks and not load entire response.
	 *
	 * @param {StreamableResponse} response - The response object to process.
	 * @returns {Promise<StreamableResponse>} - The processed response.
	 */
	protected async headerProcessing(response: StreamableResponse) {
		// Don't do work on streaming content
		if (response?.headers.has('content-type') && !(response.headers.get('content-type')?.includes('stream') || response.headers.get('content-type')?.includes('multipart'))) {
			// Define the headers we are interested in checking
			const headerChecks = ['Content-Length', 'ETag'];
			// Only run if any of the headers are missing
			if (headerChecks.every((header) => response.headers.has(header))) {
				// Split the body stream into two so we can read from one without consuming the other
				const [body1, body2] = response.body!.tee();
				const reader = body1.getReader();

				// Variable to calculate the content length
				let length = 0;
				// Create a hash object for ETag calculation if ETag header is missing
				const hash = response.headers.has('ETag') ? null : createHash('sha256');

				while (true) {
					// Read chunks from the stream
					const { done, value } = await reader.read();
					if (done) break; // Exit the loop if no more data

					// Calculate content length if 'Content-Length' header is missing
					if (!response.headers.has('Content-Length')) {
						length += value.length;
					}

					// Update hash with the chunk data if 'ETag' header is missing
					if (!response.headers.has('ETag')) {
						hash!.update(Buffer.from(value));
					}
				}

				if (!response.headers.has('Content-Length')) {
					response.headers.set('Content-Length', length.toString());
				}

				if (!response.headers.has('ETag')) {
					response.headers.set('ETag', hash!.digest('hex'));
				}

				response = new Response(body2, response);
			}
		} else {
			// Other headers not based on body
		}

		return response;
	}

	protected getFresh(customRequest: Request, initToSend: RequestInit, redirectCount: number, config: FetchHoleConfig) {
		return new Promise<StreamableResponse>((resolve, reject) => {
			if (config.cacheType != CacheType.Default) {
				this.logWriter(config.logLevel, [chalk.yellow(`${config.cacheType} Cache missed`)], [customRequest.url]);
			}

			fetch(customRequest, initToSend)
				.then(async (response: StreamableResponse) => {
					await this.responseLogging(config.logLevel, response!, customRequest.url);

					if (response.ok) {
						response = await this.headerProcessing(response);

						// TODO: Save to cache

						resolve(response);
					} else if ([301, 302, 303, 307, 308].includes(response.status)) {
						this.handleRedirect(customRequest, initToSend, response, redirectCount, config).then(resolve).catch(reject);
					} else {
						if (config.hardFail) {
							let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
							if (config.logLevel > LoggingLevel.INFO) {
								errorMsg += ` for ${customRequest.url}`;
							}
							reject(new Error(errorMsg));
						} else {
							this.logWriter(config.logLevel, [chalk.red(`HTTP ${response.status}: ${response.statusText}`)], [customRequest.url]);
							resolve(response);
						}
					}
				})
				.catch(reject);
		});
	}

	protected handleRedirect(originalRequest: Request, requestSource: RequestInit, internalResponse: StreamableResponse, redirectCount: number = 0, config: FetchHoleConfig) {
		// https://fetch.spec.whatwg.org/#http-redirect-fetch
		/**
		 * 1. **Start with a web request.** We have a request we're dealing with (let's call it `request`).
		 * 2. **Determine the real response.** Sometimes responses are modified for security (filtered). We need to use the original (internal) response.
		 * 3. **Get the redirect URL.** We look at the response to find out if and where it's redirecting us. This includes keeping any fragment identifiers (like the `#` part in URLs).
		 * 4. **No redirect? Stop here.** If there's no redirect URL, we're done and just return the response as is.
		 * 5. **Bad redirect URL? Error.** If the redirect URL is invalid or broken, we stop and report a network error.
		 * 6. **Redirects must be HTTP(S).** If the redirect URL isn't a web address (http or https), that's an error.
		 * 7. **Limit on redirects.** We can only follow up to 20 redirects in a row to prevent endless loops. Hit that limit, and it's a network error.
		 * 8. **Count each redirect.** Each time we follow a redirect, we count it (up to that limit of 20).
		 * 9. & 10. **Cross-Origin Rules.** If the request is trying to access resources from a different domain (cross-origin), there are strict rules. Especially if it involves credentials (like cookies or HTTP authentication). If these rules are broken, we return a network error.
		 * 11. **Body and Status Checks.** If there's a certain type of status code (303) and the request has a body but no source, it's a network error.
		 * 12. & 13. **Adjust Method and Headers for Cross-Origin.** Depending on the status and the request method, we might change the method to `GET` and drop the request body. If we're moving to a different origin, we also adjust the headers for security.
		 * 14. **Handle the Request Body.** If there's a body in the request, we need to handle it correctly.
		 * 15. to 17. **Timing for Debugging.** We keep track of timing for each phase of the request. This is useful for debugging and performance analysis.
		 * 18. **Remember the URLs Visited.** We keep a list of URLs we've redirected through.
		 * 19. **Handle Referrer Policy.** Adjust how much of the referrer information is passed along during a redirect.
		 * 20. **Decide on Recursive Fetch.** Normally, we keep following redirects (recursive), unless it's a manual redirect.
		 * 21. & 22. **Continue with Fetch.** Finally, we either do the redirect or return the result, depending on whether the redirect mode is manual or not.
		 */
		return new Promise<StreamableResponse>((resolve, reject) => {
			// 2
			if (originalRequest) {
				const originalUrl = new URL(originalRequest.url);
				const internalUrl = new URL(internalResponse.url);
				// 4
				if (internalResponse.headers.has('Location')) {
					try {
						// 3
						const locationURL = new URL(internalResponse.headers.get('Location')!, originalUrl);
						locationURL.hash = originalUrl.hash;
						// 6
						if (['http:', 'https:'].includes(locationURL.protocol.toLowerCase())) {
							// 7
							requestSource.redirect = config.redirectCount <= 0 ? 'error' : redirectCount == Number(config.redirectCount) ? 'error' : 'manual';
							// 8
							const newRedirectCount = redirectCount + 1;
							// 9
							if (originalRequest.mode == 'cors' && (locationURL.username !== '' || locationURL.password !== '') && originalUrl.origin !== locationURL.origin) {
								reject(new Error('NetworkError', { cause: 'CORS request with credentials to a different origin is not allowed' }));
							} else {
								// 10
								if (responseTainted(originalUrl.origin, internalResponse.headers) && (locationURL.username !== '' || locationURL.password !== '')) {
									reject(new Error('NetworkError', { cause: 'CORS policy violation due to credentials in URL during a cross-origin to same-origin redirect' }));
								} else {
									// 11
									if (internalResponse.status !== 303 && originalRequest.body !== null && requestSource.body === null) {
										reject(new Error('NetworkError', { cause: 'Invalid state with non-303 status, non-null body, and null body source' }));
									} else {
										// 12
										if (((internalResponse.status === 301 || internalResponse.status === 302) && originalRequest.method === 'POST') || (internalResponse.status === 303 && originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD')) {
											originalRequest = modifyRedirectRequest(originalRequest, requestSource);
										}
										// 13
										if (originalUrl.origin !== locationURL.origin) {
											originalRequest = dropAuthRedirect(originalRequest, requestSource);
										}
										// 14
										if (originalRequest.body !== null) {
											originalRequest = new Request(originalRequest, {
												...requestSource,
												method: originalRequest.method,
												headers: originalRequest.headers,
											});
										}
										// 15 - irrelevant since timing info is not done internally
										// 16 - irrelevant since timing info is not done internally
										// 17 - irrelevant since timing info is not done internally
										// 18 - irrelevant since there is no url history
										// 19
										let newReferrer = originalRequest.referrer;
										switch (originalRequest.referrerPolicy) {
											case 'no-referrer':
												newReferrer = '';
												break;
											case 'no-referrer-when-downgrade':
											case 'origin':
											case 'origin-when-cross-origin':
											case 'strict-origin':
											case 'strict-origin-when-cross-origin':
											case 'unsafe-url':
												newReferrer = internalUrl.toString();
												break;
											case 'same-origin':
												if (originalUrl.origin === internalUrl.origin) {
													newReferrer = internalUrl.toString();
												} else {
													newReferrer = '';
												}
												break;
										}
										// 20 - irrelevant due to this class taking over
										// 21 - irrelevant due to this class taking over
										// 22
										resolve(
											this.fetch(
												locationURL,
												{
													// Carry over
													...requestSource,
													// Override with anything touched above
													mode: originalRequest.mode,
													body: originalRequest.body,
													method: originalRequest.method,
													headers: originalRequest.headers,
													referrer: newReferrer,
												},
												newRedirectCount,
											),
										);
									}
								}
							}
						} else {
							reject(new Error('NetworkError', { cause: "locationURL's scheme is not HTTP or HTTPS" }));
						}
					} catch (error) {
						// 5
						reject(new Error('NetworkError', { cause: 'Failed to construct redirect URL' }));
					}
				} else {
					// 4
					reject(new Error('NetworkError', { cause: 'Redirect Location header is missing' }));
				}
			} else {
				reject(originalRequest);
			}
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
	public async fetch(destination: RequestInfo | URL, init?: FetchHoleFetchConfig, redirectCount: number = 0) {
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

				await this.responseLogging(config.logLevel, response!, customRequest.url);
			} else {
				// No cache found at all
				try {
					response = await this.getFresh(customRequest, initToSend, redirectCount, config);
				} catch (error) {
					mainReject(error);
				}
			}

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
