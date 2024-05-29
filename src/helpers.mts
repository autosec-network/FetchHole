export class Helpers {
	/**
	 * @link https://jsbm.dev/NHJHj31Zwm3OP
	 */
	public static bufferFromHex(hex: string) {
		return new Uint8Array(hex.length / 2).map((_, index) => parseInt(hex.slice(index * 2, index * 2 + 2), 16)).buffer;
	}

	/**
	 * @link https://jsbm.dev/AoXo8dEke1GUg
	 */
	public static bufferToHex(buffer: ReturnType<typeof this.bufferFromHex>) {
		return new Uint8Array(buffer).reduce((output, elem) => output + ('0' + elem.toString(16)).slice(-2), '');
	}

	public static getHash(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512', input: string | ArrayBufferLike) {
		return crypto.subtle.digest(algorithm, typeof input === 'string' ? new TextEncoder().encode(input) : input).then((hashBuffer) => this.bufferToHex(hashBuffer));
	}

	public static getRandomInt(min: number, max: number) {
		if (max <= min) {
			throw new Error('Max must be greater than min');
		}

		// The +1 is added to max in the randomInt call because the upper bound is exclusive
		const range = max - min + 1;
		const randomBuffer = new Uint32Array(1);

		crypto.getRandomValues(randomBuffer);
		const randomValue = randomBuffer[0]! % range;
		return min + randomValue;
	}
}
