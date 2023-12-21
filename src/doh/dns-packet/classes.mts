/**
 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-2
 */
export enum Types {
	IN = 1,
	CS = 2,
	CH = 3,
	HS = 4,
	ANY = 255,
	UNKNOWN = 0,
}

export class Classes {
	public static toString(klass: Types): string {
		if (klass in Types) {
			return Types[klass]!;
		}
		return `UNKNOWN_${klass}`;
	}

	public static toClass(): Types {
		const upperCaseName = name.toUpperCase();

		if (upperCaseName in Types) {
			return Types[upperCaseName as keyof typeof Types];
		}

		return Types.UNKNOWN;
	}
}
