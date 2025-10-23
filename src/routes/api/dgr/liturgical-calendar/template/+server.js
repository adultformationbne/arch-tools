/**
 * GET /api/dgr/liturgical-calendar/template
 * Download CSV template for Ordo calendar upload
 */
export async function GET() {
	const template = `calendar_date,liturgical_name
2027-01-01,SOLEMNITY OF MARY THE HOLY MOTHER OF GOD
2027-01-02,Saint Basil and Gregory
2027-01-03,Sunday before Epiphany
2027-01-04,Monday before Epiphany
2027-01-05,Tuesday before Epiphany
2027-01-06,THE EPIPHANY OF THE LORD
2027-01-10,THE BAPTISM OF THE LORD
2027-01-11,Monday of the first week in Ordinary Time
2027-01-12,Tuesday of the first week in Ordinary Time
2027-01-17,2 ORDINARY
`;

	return new Response(template, {
		headers: {
			'Content-Type': 'text/csv',
			'Content-Disposition': 'attachment; filename="ordo_template.csv"'
		}
	});
}
