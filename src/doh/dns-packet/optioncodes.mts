/**
 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-11
 */
export enum Options {
	LLQ = 1,
	UL = 2,
	NSID = 3,
	DAU = 5,
	DHU = 6,
	N3U = 7,
	CLIENT_SUBNET = 8,
	EXPIRE = 9,
	COOKIE = 10,
	TCP_KEEPALIVE = 11,
	PADDING = 12,
	CHAIN = 13,
	KEY_TAG = 14,
	DEVICEID = 26946,
}

export class OptionCodes {
	public static toString(type: number): string | null {
		if (type < 0) {
			return null;
		}
		return Options[type] ?? `OPTION_${type}`;
	}

	public static toCode(name?: string | number): number {
		if (typeof name === 'number') {
			return name;
		}
		if (!name) {
			return -1;
		}

		const upperCaseName = name.toUpperCase();

		if (upperCaseName in Options) {
			return Options[upperCaseName as keyof typeof Options];
		}

		if (upperCaseName.startsWith('OPCODE_')) {
			const parsedNumber = parseInt(upperCaseName.split('_')[1]!, 10);
			if (!isNaN(parsedNumber)) {
				return parsedNumber;
			}
		}

		return -1;
	}
}
