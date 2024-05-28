/**
 * Traditional DNS header RCODEs (4-bits) defined by IANA
 * @link https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
 */
export enum Rcode {
	NOERROR = 0,
	FORMERR = 1,
	SERVFAIL = 2,
	NXDOMAIN = 3,
	NOTIMP = 4,
	REFUSED = 5,
	YXDOMAIN = 6,
	YXRRSET = 7,
	NXRRSET = 8,
	NOTAUTH = 9,
	NOTZONE = 10,
	DSOTYPENI = 11,
	BADVERS = 16,
	BADSIG = 16,
	BADKEY = 17,
	BADTIME = 18,
	BADMODE = 19,
	BADNAME = 20,
	BADALG = 21,
	BADTRUNC = 22,
	BADCOOKIE = 23,
}

export class Rcodes {
	public static toString(rcode: Rcode): string {
		return Rcode[rcode] ?? `RCODE_${rcode}`;
	}

	public static toRcode(code: string): Rcode {
		const upperCaseCode = code.toUpperCase();

		if (upperCaseCode in Rcode) {
			return Rcode[upperCaseCode as keyof typeof Rcode];
		}

		return 0;
	}
}
