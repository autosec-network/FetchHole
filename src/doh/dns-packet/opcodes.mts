type opcode = string | `OPCODE_${number}`;

/**
 * Traditional DNS header OPCODEs (4-bits) defined by IANA
 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-5
 */
export enum Ops {
	QUERY = 0,
	IQUERY = 1,
	STATUS = 2,
	NOTIFY = 4,
	UPDATE = 5,
	DSO = 6,
}

export class OpCodes {
	public static toString(opcode: number): opcode {
		return Ops[opcode] ?? `OPCODE_${opcode}`;
	}

	public static toOpcode(code: opcode): number {
		const upperCaseCode = code.toUpperCase();

		if (upperCaseCode in Ops) {
			return Ops[upperCaseCode as keyof typeof Ops];
		}

		if (upperCaseCode.startsWith('OPCODE_')) {
			const parsedNumber = parseInt(upperCaseCode.split('_')[1]!, 10);
			if (!isNaN(parsedNumber)) {
				return parsedNumber;
			}
		}

		return Ops.QUERY;
	}
}
