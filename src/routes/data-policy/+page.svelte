<script>
	import { page } from '$app/stores';
	export let data;
	$: ({ session, platform } = data);
</script>

<svelte:head>
	<title>Privacy Policy - {platform.name}</title>
</svelte:head>

<div class="container mx-auto px-4 py-8 max-w-4xl">
	<div class="bg-white shadow-lg rounded-lg p-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
		<p class="text-sm text-gray-600 mb-8">How {platform.name} collects, uses and protects your information.</p>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">How we treat your data</h2>
			<p class="text-gray-700 mb-4">
				The parishes, schools and agencies of the Archdiocese of Brisbane (<em>we</em>, <em>us</em> or
				<em>our</em>) may collect, use and disclose personal information about you. We collect personal
				information directly from you and may also collect personal information passively through our
				website.
			</p>
			<p class="text-gray-700 mb-4">
				We collect your personal information to fulfil the mission and directions of our organisation,
				to administer the sacraments and provide pastoral care to you, to provide you with other
				services and products you are seeking, to communicate with you about the services and products
				we offer, to solicit donations and to comply with our legal and regulatory requirements. If the
				personal information you provide is incomplete or inaccurate, we may not be able to provide you
				with the services or products you seek.
			</p>
			<p class="text-gray-700 mb-4">
				We may disclose personal information about you to our parishes, schools and agencies and
				service providers who assist us in operating our organisation.
			</p>
			<p class="text-gray-700">
				Our Privacy Policy sets out how you can access and ask for correction of your personal
				information, how you can complain about privacy-related matters and how we respond to
				complaints.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Contact details</h2>
			<div class="bg-gray-50 p-4 rounded-lg">
				<p class="text-gray-700">
					<strong>Address:</strong> GPO Box 282, Brisbane, Queensland, 4001
				</p>
				<p class="text-gray-700 mt-2">
					<strong>Email address:</strong>
					<a href="mailto:privacyofficer@bne.catholic.net.au" class="text-blue-600 hover:text-blue-800">privacyofficer@bne.catholic.net.au</a>
				</p>
			</div>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Safeguarding Commitment</h2>
			<p class="text-gray-700">
				Archdiocesan Ministries is actively committed to upholding the dignity of all human life by
				providing and facilitating spaces that are emotionally, physically, and spiritually safe in our
				work of supporting parishes and communities in the Archdiocese. We commit to maintaining
				policies and practices that promote a culture that values strong safeguarding principles and
				present a sense of sanctuary for the vulnerable. As an organisation, we commit to listening,
				walking alongside, and sharing the appropriate avenues for support for those who make
				disclosures of personal sensitive information.
			</p>
		</section>

		<hr class="my-8 border-gray-200" />

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">How this applies to {platform.name}</h2>
			<p class="text-gray-700">
				The section below explains, specifically, what {platform.name} collects and does when you
				enrol in or participate in a formation course (e.g. ACCF — Archdiocesan Centre for Catholic
				Formation) — supplementing the archdiocese-wide policy above.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Information we collect at signup</h2>
			<p class="text-gray-700 mb-4">
				When you enrol in a course through an enrolment link, we collect:
			</p>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Your name, email address and phone number</li>
				<li>Your mailing address</li>
				<li>Your parish (or a free-text answer if it's not in our list)</li>
				<li>How you heard about the course</li>
				<li>The cohort, module and hub (location) you're enrolling into</li>
				<li>Payment details for paid courses — handled directly by Stripe; we never see or store your card details (see "Payments" below)</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Information we collect as a participant</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Attendance records for sessions</li>
				<li>Written reflection submissions, and grading/feedback on them</li>
				<li>Your progress through the course (current session, completion status)</li>
				<li>Login activity, for account security</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">How we use your information</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>To create and manage your enrolment and course account</li>
				<li>To send you enrolment confirmations, sign-in links and course-related emails</li>
				<li>To let your hub coordinator know who's enrolled at their hub, so they can support participants</li>
				<li>To process payments and issue receipts (paid courses)</li>
				<li>To track attendance, progress and reflection grading as part of course delivery</li>
				<li>To maintain transcript and completion records</li>
			</ul>
			<p class="text-gray-700 mt-4">
				We do not sell your information or use it for advertising, and we do not share it outside
				the archdiocese except with the service providers below, strictly to run the platform.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Who can see your information</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Course administrators</strong> for the course you're enrolled in</li>
				<li><strong>Your hub coordinator</strong> (if you're enrolled at a hub) — sees that you've enrolled and your hub's participant count</li>
				<li><strong>You</strong> — your own reflections and grading are visible only to you and course administrators, never to other participants</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Payments</h2>
			<p class="text-gray-700">
				Paid courses are processed by <strong>Stripe</strong>. We never receive or store your card
				number. Stripe issues its own payment confirmation, and we separately send a course-branded
				receipt. Refunds and payment disputes are handled through Stripe.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">How we protect your data</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Secure sign-in:</strong> accounts are protected by Supabase Auth; we never see or store your password</li>
				<li><strong>Access controls:</strong> only staff assigned to a course can see that course's participant data</li>
				<li><strong>Encrypted infrastructure:</strong> data is stored on Supabase's secure PostgreSQL infrastructure</li>
				<li><strong>Row-level security:</strong> database policies restrict access to authorised users only</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Data retention</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li>Enrolment and completion records are kept indefinitely for transcript purposes</li>
				<li>Reflection submissions and grading are kept as part of your course record</li>
				<li>Attendance records are retained for the duration of the course and archived on completion</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Third-party services we use</h2>
			<ul class="list-disc list-inside text-gray-700 space-y-2 ml-4">
				<li><strong>Supabase:</strong> authentication, database and hosting</li>
				<li><strong>Stripe:</strong> payment processing for paid courses</li>
				<li><strong>Resend:</strong> sending enrolment, sign-in and course-related emails</li>
			</ul>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Your rights</h2>
			<p class="text-gray-700">
				You can ask to see, correct, or request deletion of your personal information at any time by
				contacting the Privacy Officer above, or our technical support team below. Some information
				(e.g. completion records) may need to be retained for accreditation purposes even after a
				deletion request.
			</p>
		</section>

		<section class="mb-8">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Technical support</h2>
			<p class="text-gray-700 mb-4">
				For technical issues with this platform (not privacy requests — see above), contact:
			</p>
			<div class="bg-gray-50 p-4 rounded-lg">
				<p class="text-gray-700">
					<a href="mailto:desicl@bne.catholic.net.au" class="text-blue-600 hover:text-blue-800">desicl@bne.catholic.net.au</a>
				</p>
			</div>
		</section>

		<footer class="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
			<p>Last updated: July 2026</p>
			<p>This policy applies to {platform.name}, including course enrolment, participation and internal ministry use.</p>
		</footer>
	</div>
</div>
