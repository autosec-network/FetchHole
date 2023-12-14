export function responseTainted(originalUrlOrigin: typeof URL.prototype.origin, responseHeaders: Headers) {
	const allowedOrigin = responseHeaders.get('Access-Control-Allow-Origin');
	const allowCredentials = responseHeaders.get('Access-Control-Allow-Credentials');

	// Check if the 'Access-Control-Allow-Origin' header is missing or doesn't match the request's origin.
	const isOriginNotAllowed = allowedOrigin !== '*' && allowedOrigin !== originalUrlOrigin;

	// Check if credentials are allowed but origins do not match.
	const isCredentialsMismatch = allowCredentials === 'true' && allowedOrigin !== originalUrlOrigin;

	return isOriginNotAllowed || isCredentialsMismatch;
}

export function modifyRedirectRequest(originalRequest: Request, requestSource: RequestInit) {
	// https://fetch.spec.whatwg.org/#request-body-header-name
	const requestBodyHeaders = ['Content-Encoding', 'Content-Language', 'Content-Location', 'Content-Type'];

	// Create a copy of the original headers, then delete the request-body-related headers
	const newHeaders = new Headers(originalRequest.headers);
	requestBodyHeaders.forEach((headerName) => {
		newHeaders.delete(headerName);
	});

	return new Request(originalRequest, {
		...requestSource,
		method: 'GET',
		body: null,
		headers: newHeaders,
		referrer: originalRequest.referrer,
	});
}

export function dropAuthRedirect(originalRequest: Request, requestSource: RequestInit) {
	// https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name
	const requestBodyHeaders = ['Authorization'];

	// Create a copy of the original headers, then delete the request-body-related headers
	const newHeaders = new Headers(originalRequest.headers);
	requestBodyHeaders.forEach((headerName) => {
		newHeaders.delete(headerName);
	});

	return new Request(originalRequest, {
		...requestSource,
		method: originalRequest.method,
		body: originalRequest.body,
		headers: newHeaders,
		referrer: originalRequest.referrer,
	});
}
