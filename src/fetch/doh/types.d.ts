import type { RecordType } from 'dns-packet';

export type ExcludeUndefined<T> = T extends undefined ? never : T;

export interface DohRequest {
	/**
	 * The hostname of the DNS record to query (e.g., "example.com").
	 */
	name: string;
	/**
	 * RR type can be represented as a canonical string. You can use 'ANY' queries but be aware that this is not a replacement for sending queries for both A and AAAA or MX records. Authoritative name servers need not return all records for such queries; some do not respond, and others (such as cloudflare.com) return only HINFO.
	 * @default `A`
	 */
	type?: RecordType;
	/**
	 * The CD (Checking Disabled) flag. Use cd=1, or cd=true to disable DNSSEC validation; use cd=0, cd=false, or no cd parameter to enable DNSSEC validation.
	 * @default false
	 */
	cd?: 0 | 1 | boolean;
	/**
	 * Desired content type option. Use ct=application/dns-message to receive a binary DNS message in the response HTTP body instead of JSON text. Use ct=application/dns-json to explicitly request JSON text. Other content type values are ignored and default JSON content is returned.
	 * @default `application/dns-message` if resolver ends with `/dns-query` otherwise `application/dns-json`
	 */
	ct?: 'application/dns-message' | 'application/dns-json';
	/**
	 * The DO (DNSSEC OK) flag. Use do=1, or do=true to include DNSSEC records (RRSIG, NSEC, NSEC3); use do=0, do=false, or no do parameter to omit DNSSEC records.
	 * @default false
	 */
	do?: 0 | 1 | boolean;
	/**
	 * The edns0-client-subnet option. Format is an IP address with a subnet mask.
	 * If you are using DNS-over-HTTPS because of privacy concerns, and do not want any part of your IP address to be sent to authoritative name servers for geographic location accuracy, use edns_client_subnet=`0.0.0.0/0`. Google Public DNS normally sends approximate network information (usually zeroing out the last part of your IPv4 address).
	 * @example `1.2.3.4/24`
	 * @example `2001:700:300::/48`
	 */
	edns_client_subnet?: `${number}.${number}.${number}.${number}/${number}` | string;
	/**
	 * The value of this parameter is ignored
	 * API clients concerned about possible side-channel privacy attacks using the packet sizes of HTTPS GET requests can use this to make all requests exactly the same size by padding requests with random data. To prevent misinterpretation of the URL, restrict the padding characters to the unreserved URL characters: upper- and lower-case letters, digits, hyphen, period, underscore and tilde.
	 * @example `XmkMw~o_mgP2pf.gpw-Oi5dK`
	 */
	random_padding?: string;
}

interface ResponseValues {
	/**
	 * FQDN with trailing dot
	 */
	name: string;
	/**
	 * The type of DNS record requested
	 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
	 */
	type: string | number;
	/**
	 * The number of seconds the answer can be stored in cache before it is considered stale.
	 */
	TTL: number;
	/**
	 * The value of the DNS record for the given name and type. The data will be in text for standardized record types and in hex for unknown types.
	 */
	data: string;
}

export interface DohSuccessfulResponse {
	/**
	 * The Response Code of the DNS Query. Defined here: https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
	 */
	Status: number;
	/**
	 * Whether the response is truncated. This happens when the DNS answer is larger than a single UDP or TCP packet
	 */
	TC: boolean;
	/**
	 * Recursive Desired bit was set. This is always set to true for Cloudflare DNS over HTTPS & Google Public DNS
	 */
	RD: boolean;
	/**
	 * Recursion Available bit was set. This is always set to true for Cloudflare DNS over HTTPS & Google Public DNS
	 */
	RA: boolean;
	/**
	 * Every record in the answer was verified with DNSSEC
	 */
	AD: boolean;
	/**
	 * Whether the client asked to disable DNSSEC. In this case, DoH resolver will still fetch the DNSSEC-related records, but it will not attempt to validate the records
	 */
	CD: boolean;
	/**
	 * The record requested
	 */
	Question: {
		/**
		 * FQDN with trailing dot
		 */
		name: string;
		/**
		 * The type of DNS record requested
		 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
		 */
		type: string | number;
	}[];
	/**
	 * The answer record
	 */
	Answer?: ResponseValues[];
	/**
	 * DNS servers that have authority over the domain in question
	 */
	Authority: ResponseValues[];
	/**
	 * The Supplemental records
	 */
	Additional: ResponseValues[];
	/**
	 * List of EDE messages. Refer to Extended DNS error codes for more information
	 * @link https://developers.cloudflare.com/1.1.1.1/infrastructure/extended-dns-error-codes/
	 */
	Comment?: string | string[];
}

/**
 * An error response from Cloudflare's 1.1.1.1 DNS over HTTPS API
 */
export type DohErrorResponse = {
	/** An explanation of the error that occurred */
	error: string;
};
