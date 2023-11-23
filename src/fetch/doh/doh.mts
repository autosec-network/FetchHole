import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { DohWireframeDecoders } from './decoders.mjs';
import type { DohRequest, DohSuccessfulResponse, ExcludeUndefined, ResponseValues } from './types.js';

enum DnsRecordType {
	A = 1, // RFC 1035
	AAAA = 28, // RFC 3596
	AFSDB = 18, // RFC 1183
	APL = 42, // RFC 3123
	CAA = 257, // RFC 6844
	CDNSKEY = 60, // RFC 7344
	CDS = 59, // RFC 7344
	CERT = 37, // RFC 4398
	CNAME = 5, // RFC 1035
	CSYNC = 62, // RFC 7477
	DHCID = 49, // RFC 4701
	DLV = 32769, // RFC 4431
	DNAME = 39, // RFC 6672
	DNSKEY = 48, // RFC 4034
	DS = 43, // RFC 4034
	EUI48 = 108, // RFC 7043
	EUI64 = 109, // RFC 7043
	HINFO = 13, // RFC 8482
	HIP = 55, // RFC 8005
	HTTPS = 65, // RFC 9460
	IPSECKEY = 45, // RFC 4025
	KEY = 25, // RFC 2535, RFC 2930
	KX = 36, // RFC 2230
	LOC = 29, // RFC 1876
	MX = 15, // RFC 1035, RFC 7505
	NAPTR = 35, // RFC 3403
	NS = 2, // RFC 1035
	NSEC = 47, // RFC 4034
	NSEC3 = 50, // RFC 5155
	NSEC3PARAM = 51, // RFC 5155
	OPENPGPKEY = 61, // RFC 7929
	PTR = 12, // RFC 1035
	RRSIG = 46, // RFC 4034
	RP = 17, // RFC 1183
	SIG = 24, // RFC 2535
	SMIMEA = 53, // RFC 8162
	SOA = 6, // RFC 1035, RFC 2308
	SRV = 33, // RFC 2782
	SSHFP = 44, // RFC 4255
	SVCB = 64, // RFC 9460
	TA = 32768,
	TKEY = 249, // RFC 2930
	TLSA = 52, // RFC 6698
	TSIG = 250, // RFC 2845
	TXT = 16, // RFC 1035
	URI = 256, // RFC 7553
	ZONEMD = 63, // RFC 8976
	ANY = 255, // RFC 1035
	AXFR = 252, // RFC 1035
	IXFR = 251, // RFC 1996
	OPT = 41, // RFC 6891
	// Add any additional record types as needed
}

export class DohResolver {
	private nameserver_url: URL;

	constructor(nameserver_url: string | URL) {
		this.nameserver_url = new URL(nameserver_url);
	}

	// public async query(parameters: DohRequest, timeout: number = 10 * 1000): Promise<DohSuccessfulResponse | DohErrorResponse> {
	public async query(parameters: DohRequest, timeout: number = 10 * 1000) {
		if (!('ct' in parameters)) {
			if (this.nameserver_url.pathname === '/dns-query') {
				parameters.ct = 'application/dns-message';
			} else {
				parameters.ct = 'application/dns-json';
			}
		}

		switch (parameters.ct) {
			case 'application/dns-message': {
				const dnsMessage = this.createDnsMessage(parameters);
				const response = await this.sendDohMsg('POST', parameters.ct, timeout, this.nameserver_url, dnsMessage);
				return this.parseDnsMessage(await response.arrayBuffer());
			}
			case 'application/dns-json': {
				const response = await this.sendDohMsg('GET', parameters.ct, timeout, this.makeJsonGetQuery(this.nameserver_url, parameters));
				return response.json();
			}
		}
	}

	private makeJsonGetQuery(url: URL, parameters: DohRequest): URL {
		Object.entries(parameters).forEach(([key, value]) => {
			if (value !== undefined) {
				url.searchParams.set(key, value.toString());
			}
		});

		return url;
	}

	/**
	 * Creates a DNS query message in binary format according to RFC 1035 and RFC 8484.
	 *
	 * @param parameters The DNS query parameters.
	 * @returns An ArrayBuffer containing the binary DNS query message.
	 */
	private createDnsMessage(parameters: DohRequest): Buffer {
		// DNS Header Fields
		const id = randomBytes(2); // Transaction ID: 2 bytes
		let flags = Buffer.alloc(2); // Flags: 2 bytes
		flags[0] = 0x01; // Standard query with recursion desired
		const qdcount = Buffer.from([0x00, 0x01]); // Number of questions: 1
		const ancount = Buffer.from([0x00, 0x00]); // Number of answer RRs: 0
		const nscount = Buffer.from([0x00, 0x00]); // Number of authority RRs: 0
		const arcount = Buffer.from([0x00, 0x00]); // Number of additional RRs: 0

		// Question Section
		const qname = this.encodeDomainName(parameters.name); // QNAME
		let qtype = Buffer.alloc(2);
		let qclass = Buffer.from([0x00, 0x01]); // QCLASS: IN (Internet)

		// Determine QTYPE
		if (typeof parameters.type === 'number') {
			qtype = Buffer.from([parameters.type >> 8, parameters.type & 0xff]);
		} else if (typeof parameters.type === 'string') {
			qtype = this.getQtypeFromName(parameters.type);
		} else {
			qtype = Buffer.from([0x00, 0x01]); // Default to A record
		}

		// Combine all parts
		const query = Buffer.concat([id, flags, qdcount, ancount, nscount, arcount, qname, qtype, qclass]);

		return query;
	}

	/**
	 * Encodes a domain name into the format specified in RFC 1035.
	 *
	 * @param domain The domain name to encode.
	 * @returns A Buffer containing the encoded domain name.
	 */
	private encodeDomainName(domain: string): Buffer {
		const parts = domain.split('.');
		const buffers = parts.map((part) => {
			const length = Buffer.from([part.length]);
			const content = Buffer.from(part);
			return Buffer.concat([length, content]);
		});
		return Buffer.concat([...buffers, Buffer.from([0x00])]); // Null byte at the end
	}

	/**
	 * Maps a DNS record type name to its corresponding type value.
	 *
	 * @param typeName The DNS record type name.
	 * @returns A Buffer representing the type value.
	 */
	private getQtypeFromName(typeName: string): Buffer {
		const typeValue = DnsRecordType[typeName.toUpperCase() as keyof typeof DnsRecordType];

		if (typeValue === undefined) {
			throw new Error(`Unknown DNS record type: ${typeName}`);
		}

		return Buffer.from([typeValue >> 8, typeValue & 0xff]);
	}

	/**
	 * Parses a DNS response message from binary format to a DohSuccessfulResponse.
	 *
	 * @param response The binary DNS response message.
	 * @returns A DohSuccessfulResponse object representing the parsed DNS message.
	 */
	private parseDnsMessage(response: ArrayBuffer): DohSuccessfulResponse {
		const buffer = Buffer.from(response);

		// Parsing the DNS Header
		const flags = buffer.slice(2, 4);
		const qdcount = buffer.readUInt16BE(4);
		const ancount = buffer.readUInt16BE(6);
		const nscount = buffer.readUInt16BE(8);
		const arcount = buffer.readUInt16BE(10);

		// Initialize response object
		let parsedResponse: DohSuccessfulResponse = {
			Status: flags.readUInt16BE(0) & 0xf, // Last four bits represent RCODE
			TC: (flags[0] & 0x2) > 0, // Truncation flag
			RD: (flags[0] & 0x1) > 0, // Recursion Desired
			RA: (flags[1] & 0x80) > 0, // Recursion Available
			AD: (flags[1] & 0x20) > 0, // Authenticated Data
			CD: (flags[1] & 0x10) > 0, // Checking Disabled
			Question: [],
			Answer: [],
			Authority: [],
			Additional: [],
		};

		// Parsing Sections
		let offset = 12; // Initial offset after the header
		let parsedSection;

		// Parse Question Section
		parsedSection = this.parseSection(buffer, offset, qdcount, true);
		parsedResponse.Question = parsedSection.records;
		offset = parsedSection.newOffset;

		// Parse Answer Section
		parsedSection = this.parseSection(buffer, offset, ancount);
		parsedResponse.Answer = parsedSection.records;
		offset = parsedSection.newOffset;

		// Parse Authority Section
		parsedSection = this.parseSection(buffer, offset, nscount);
		parsedResponse.Authority = parsedSection.records;
		offset = parsedSection.newOffset;

		// Parse Additional Section
		parsedSection = this.parseSection(buffer, offset, arcount);
		parsedResponse.Additional = parsedSection.records;

		return parsedResponse;
	}

	/**
	 * Parses a section (question or resource record) from a DNS message.
	 *
	 * @param buffer The DNS message buffer.
	 * @param offset The offset where the section starts.
	 * @param count The number of records to parse in the section.
	 * @param isQuestionSection A boolean flag indicating if the section is a question section.
	 * @returns An array of parsed records and the new offset after parsing.
	 */
	private parseSection(buffer: Buffer, offset: number, count: number, isQuestionSection: boolean = false): { records: ResponseValues[]; newOffset: number } {
		let records = [];
		let currentOffset = offset;

		for (let i = 0; i < count; i++) {
			let record = { name: '', type: 0, TTL: 0, data: '' };
			const { name, newOffset: nameOffset } = DohWireframeDecoders.decodeDomainName(buffer, currentOffset);
			record.name = name;
			currentOffset = nameOffset;

			record.type = buffer.readUInt16BE(currentOffset);
			currentOffset += 2; // Skip type

			if (!isQuestionSection) {
				currentOffset += 2; // Skip class
				record.TTL = buffer.readUInt32BE(currentOffset);
				currentOffset += 4;
				const rdlength = buffer.readUInt16BE(currentOffset);
				currentOffset += 2;

				switch (record.type) {
					case DnsRecordType.A:
						if (rdlength === 4) {
							record.data = DohWireframeDecoders.parseIPv4Address(buffer, currentOffset);
						}
						break;
					case DnsRecordType.AAAA:
						if (rdlength === 16) {
							record.data = DohWireframeDecoders.parseIPv6Address(buffer, currentOffset);
						}
						break;
					case DnsRecordType.CNAME:
						const { name: cname } = DohWireframeDecoders.decodeDomainName(buffer, currentOffset);
						record.data = cname;
						break;
					// Add more cases as needed
				}
				currentOffset += rdlength;
			}

			records.push(record);
		}

		return { records, newOffset: currentOffset };
	}

	private async sendDohMsg(method: 'GET' | 'POST', ct: ExcludeUndefined<DohRequest['ct']>, timeout: number, url: URL, body?: Buffer): Promise<Response> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeout);

		const headers = new Headers();
		headers.set('Content-Type', ct);
		headers.set('Accept', ct);

		const response = await fetch(url, {
			method: method,
			headers: headers,
			body: body, // Using Buffer directly
			signal: controller.signal,
		});

		clearTimeout(timer);

		if (response.ok || response.status === 304) {
			return response;
		} else {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
	}
}
