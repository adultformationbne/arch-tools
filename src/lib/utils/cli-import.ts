/**
 * tickets.org export parser.
 * Detects the tickets.org CSV/XLSX export format, analyses ticket types,
 * and translates rows into the standard participant shape used by CsvUpload.
 * Works with the raw .xlsx export, a manually edited version, or a CSV re-export.
 */

export interface CliTicketTypeInfo {
	ticketType: string;
	count: number;
	orderCount: number;
	isLikelyHub: boolean;
	suggestedHubName: string;
}

export interface CliTicketMapping {
	isHub: boolean;
	hubName: string;
}

export interface CliParsedRow {
	email: string;
	full_name: string;
	first_name: string | null;
	last_name: string | null;
	phone: string | null;
	address: string | null;
	parish_community: string | null;
	parish_role: string | null;
	hub: string | null;
	role: 'student';
	notes: string | null;
}

// Columns that uniquely identify the CLI ticketing platform export
const CLI_SIGNATURE = ['order number', 'ticket type', 'ticket #', 'payment status', 'checked in'];

/** RFC 4180-compliant CSV row parser (handles commas inside quoted fields). */
export function parseCSVRow(line: string): string[] {
	const fields: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') {
			if (inQuotes && line[i + 1] === '"') {
				field += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (c === ',' && !inQuotes) {
			fields.push(field.trim());
			field = '';
		} else {
			field += c;
		}
	}
	fields.push(field.trim());
	return fields;
}

/** Returns true when the header row matches the CLI ticketing platform export format. */
export function detectCliFormat(firstLine: string): boolean {
	const lower = firstLine.toLowerCase();
	return CLI_SIGNATURE.filter((s) => lower.includes(s)).length >= 4;
}

interface CliColMap {
	orderNumber: number;
	ticketType: number;
	firstName: number;
	surname: number;
	phone1: number;
	phone2: number;
	mailingAddress: number;
	parishCommunity: number;
	email: number;
	parishRole: number;
	discountCode: number;
	emailAddress: number;
}

function buildCliColMap(headerLine: string): CliColMap {
	const headers = parseCSVRow(headerLine).map((h) => h.toLowerCase().trim());
	const find = (name: string) => headers.findIndex((h) => h === name || h.startsWith(name));

	// The CLI export has two "Phone" columns — collect both indices
	const phoneIndices = headers.reduce<number[]>((acc, h, i) => {
		if (h === 'phone') acc.push(i);
		return acc;
	}, []);

	return {
		orderNumber: find('order number'),
		ticketType: find('ticket type'),
		firstName: find('first name'),
		surname: find('surname'),
		phone1: phoneIndices[0] ?? -1,
		phone2: phoneIndices[1] ?? -1,
		mailingAddress: find('mailing address'),
		parishCommunity: find('your parish or community'),
		email: find('email'),
		parishRole: find('role/s in parish'),
		discountCode: find('discount code'),
		// "Email Address" is the billing/order email; col "Email" is the participant email
		emailAddress: find('email address'),
	};
}

/** Returns one entry per unique ticket type found in the file, with hub suggestions. */
export function analyzeCliTicketTypes(lines: string[]): CliTicketTypeInfo[] {
	const m = buildCliColMap(lines[0]);
	const typeMap = new Map<string, { count: number; orders: Set<string> }>();

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue;
		const row = parseCSVRow(lines[i]);
		const ticketType = row[m.ticketType]?.trim();
		const orderNum = row[m.orderNumber]?.trim();
		if (!ticketType) continue;

		if (!typeMap.has(ticketType)) typeMap.set(ticketType, { count: 0, orders: new Set() });
		const info = typeMap.get(ticketType)!;
		info.count++;
		if (orderNum) info.orders.add(orderNum);
	}

	return [...typeMap.entries()].map(([ticketType, { count, orders }]) => {
		const isLikelyHub = ticketType.toLowerCase().endsWith(' hub');
		return {
			ticketType,
			count,
			orderCount: orders.size,
			isLikelyHub,
			suggestedHubName: isLikelyHub ? ticketType : '',
		};
	});
}

function isEmail(s: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** Translates CLI export rows to the standard participant shape, applying hub mappings. */
export function translateCliRows(
	lines: string[],
	mappings: Map<string, CliTicketMapping>
): CliParsedRow[] {
	const m = buildCliColMap(lines[0]);
	const results: CliParsedRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		if (!lines[i].trim()) continue;
		const row = parseCSVRow(lines[i]);

		const firstName = (row[m.firstName] ?? '').trim().replace(/\s+/g, ' ');
		const lastName = (row[m.surname] ?? '').trim().replace(/\s+/g, ' ');
		const fullName = [firstName, lastName].filter(Boolean).join(' ');

		// Participant email (col 9) takes priority over billing email (col 16)
		const email = ((row[m.email] ?? '') || (row[m.emailAddress] ?? '')).trim().toLowerCase();
		if (!email || !isEmail(email) || !fullName) continue;

		// Some group orders have phone only in the second phone column
		const phone = (row[m.phone1]?.trim() || row[m.phone2]?.trim()) || null;

		// Skip address field if it looks like an email (a common data-entry quirk in this export)
		const rawAddr = row[m.mailingAddress]?.trim() ?? '';
		const address = rawAddr && !rawAddr.includes('@') ? rawAddr : null;

		const parishCommunity = row[m.parishCommunity]?.trim() || null;
		const parishRole = row[m.parishRole]?.trim() || null;
		const discountCode = row[m.discountCode]?.trim() || null;
		const ticketType = row[m.ticketType]?.trim() ?? '';

		const mapping = mappings.get(ticketType);
		const hub = mapping?.isHub && mapping.hubName.trim() ? mapping.hubName.trim() : null;

		const noteParts: string[] = [];
		if (discountCode) noteParts.push(`Code: ${discountCode}`);

		results.push({
			email,
			full_name: fullName,
			first_name: firstName || null,
			last_name: lastName || null,
			phone: phone ? phone.replace(/\s+/g, ' ') : null,
			address,
			parish_community: parishCommunity,
			parish_role: parishRole,
			hub,
			role: 'student',
			notes: noteParts.length ? noteParts.join('; ') : null,
		});
	}

	return results;
}
