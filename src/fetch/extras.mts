export function responseTainted(originalUrlOrigin: typeof URL.prototype.origin, responseHeaders: Headers) {
	const allowedOrigin = responseHeaders.get('Access-Control-Allow-Origin');
	const allowCredentials = responseHeaders.get('Access-Control-Allow-Credentials');

	// Check if the 'Access-Control-Allow-Origin' header is missing or doesn't match the request's origin.
	const isOriginNotAllowed = allowedOrigin !== '*' && allowedOrigin !== originalUrlOrigin;

	// Check if credentials are allowed but origins do not match.
	const isCredentialsMismatch = allowCredentials === 'true' && allowedOrigin !== originalUrlOrigin;

	return isOriginNotAllowed || isCredentialsMismatch;
}
