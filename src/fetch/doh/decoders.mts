import { Buffer } from 'node:buffer';

export class DohWireframeDecoders {
	public static parseIPv4Address(buffer: Buffer, offset: number): string {
		return Array.from({ length: 4 }, (_, i) => buffer[offset + i].toString()).join('.');
	}

	public static parseIPv6Address(buffer: Buffer, offset: number): string {
		return Array.from({ length: 16 }, (_, i) => buffer[offset + i].toString(16).padStart(2, '0'))
			.reduce((acc, value, index) => acc + (index % 2 ? ':' : '') + value, '')
			.replace(/(:0)+:/, '::'); // Compress zeros
	}

	/**
	 * Decodes a domain name from its binary format in a DNS message.
	 *
	 * @param buffer The DNS message buffer.
	 * @param offset The offset where the domain name starts.
	 * @returns The decoded domain name and the new offset after parsing.
	 */
	public static decodeDomainName(buffer: Buffer, offset: number): { name: string; newOffset: number } {
		let name = '';
		let jumped = false;
		let originalOffset = offset;
		let length = buffer[offset];

		// Loop through each character in the domain name
		while (length > 0) {
			if ((length & 0xc0) === 0xc0) {
				// Handle pointer (compression)
				if (!jumped) {
					originalOffset = offset + 2;
					jumped = true;
				}
				offset = ((length & 0x3f) << 8) | buffer[offset + 1]; // Read new offset from the pointer
				length = buffer[offset];
			} else {
				// Regular label
				name += buffer.toString('ascii', offset + 1, offset + 1 + length) + '.';
				offset += length + 1;
				length = buffer[offset];
			}
		}

		return {
			name: name.endsWith('.') ? name.slice(0, -1) : name, // Remove the trailing dot if present
			newOffset: jumped ? originalOffset : offset + 1,
		};
	}
}
