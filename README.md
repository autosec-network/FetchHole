[![License](https://img.shields.io/github/license/autosec-network/FetchHole)](LICENSE)
[![TypeScript](https://badgen.net/npm/types/@autosec-network/FetchHole)](https://www.npmjs.com/package/@autosec/fetchhole)
[![npm](https://img.shields.io/npm/v/@autosec-network/FetchHole)](https://www.npmjs.com/package/@autosec/fetchhole)
[![npm](https://img.shields.io/npm/dm/@autosec-network/FetchHole)](https://www.npmjs.com/package/@autosec/fetchhole)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/autosec-network/FetchHole/badge)](https://securityscorecards.dev/viewer/?uri=github.com/autosec-network/FetchHole)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@autosec-network/FetchHole)](https://socket.dev/npm/package/@autosec-network/FetchHole)

# FetchHole

Elevate your Function as a Service (FaaS) development with enhanced security at the edge using `@autosec/fetchhole`. This package acts as a sophisticated drop-in replacement for the native `fetch()` function, tailored for developers who emphasize security in their web applications.

## Features

-   **Drop-in Replacement**: Seamlessly integrates with existing code, replacing the native `fetch()` function.
-   **Advanced Logging**: Comprehensive logging capabilities for effective debugging.
-   **Redirect Intercept**: Customize redirect limits with a default of 20, as per the WHATWG Fetch specification.
-   **Header Computation**: Automatically computes and adds missing `Content-Length` and `ETag` headers. Choose your preferred ETag hash algorithm, with `sha256` as the default.
-   **Cache Support**: Utilizes memory or disk caching via the Cache Web API. Compatible with Cloudflare's cache API for Cloudflare users.
-   **Intercept for Alternate Routing**: Ideal for scenarios like Cloudflare Workers Binding, allowing for alternate request routing.
-   **Custom DNS Resolver Support**: Designed for DNS level security applications like Zero Trust services. Compatible with any DoH resolver that uses `0.0.0.0` for blocking.
    -   **Direct IP Address Handling**: Offers three modes for handling direct IP address access:
        -   Full Block
        -   Fail if No PTR Record (conducts a PTR record check, followed by a standard DNS check)
        -   Allow

## Supported Environments

-   [x] NodeJS v16.15.0 or later (that's when NodeJS got native `fetch()` support) environments
-   [ ] Browser support
-   [x] Cloudflare Workers/Pages with `compatibility_flags = [ "nodejs_compat" ]` (not to be confused with `node_compat = true`)
    > [!NOTE]
    > When Browser support lands, it's still recommended to use `nodejs_compat` because those apis run faster and are more robust

## Installation

```bash
npm install @autosec/fetchhole
```

## Usage

Simply import fetchhole and use it as a replacement for the native fetch() function.

```ts
// TODO
```

## Configuration

You can customize fetchhole with various options to suit your needs. Settings can be applied at the class instance level or as an fetch init property:

```ts
{
	cache: {
		type: CacheType.Default, // Defines cache type
		hashAlgorithm: 'sha256', // Choose a different ETag hash algorithm
		ignoreMethod: false,
		ignoreSearch: false,
		ignoreVary: false,
	},
	hardFail: true, // Determines failure handling
	logLevel: LoggingLevel.INFO, // Sets the level of logging
	redirectCount: 20, // Set custom redirect limit
}
```
