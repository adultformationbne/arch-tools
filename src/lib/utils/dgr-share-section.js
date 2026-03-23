/**
 * Generate a "Share with a Friend" section for DGR posts
 * Uses Web Share API for native device sharing (iOS/Android share sheet, desktop share)
 * Falls back to mailto: for browsers without Web Share support
 */

export function generateShareSection(postTitle = '') {
	const subscribeUrl = 'https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g';
	const shareTitle = 'Daily Gospel Reflections';
	const shareText = postTitle || shareTitle;

	// mailto: fallback for browsers without Web Share API
	const subject = encodeURIComponent(`Daily Gospel Reflections \u2013 I thought you\u2019d enjoy this`);
	const body = encodeURIComponent(
		"Hi,\n\n" +
		shareText + "\n" +
		subscribeUrl + "\n\n" +
		"God bless!"
	);
	const mailtoLink = `mailto:?subject=${subject}&body=${body}`;

	// Inline script uses navigator.share() when available, falls back to mailto:
	const onClickHandler = [
		`event.preventDefault();`,
		`if (navigator.share) {`,
		`navigator.share({`,
		`title: '${shareTitle}',`,
		`text: '${shareText.replace(/'/g, "\\'")}',`,
		`url: '${subscribeUrl}'`,
		`}).catch(function(){});`,
		`} else {`,
		`window.location.href = '${mailtoLink}';`,
		`}`
	].join(' ');

	// Single line to prevent WordPress wpautop from adding <br> tags
	return `<div style="text-align: center; margin: 40px auto 0; max-width: 700px; padding: 0 20px;"><div style="border-top: 1px solid #e8e8e8; padding-top: 32px;"><p style="font-family: 'PT Serif', Georgia, serif; font-size: 20px; color: #2c7777; margin: 0 0 8px; font-weight: 600;">Know someone who&rsquo;d enjoy this?</p><p style="font-size: 14px; color: #666; margin: 0 0 20px;">Share today&rsquo;s reflection with a friend.</p><a href="${mailtoLink}" onclick="${onClickHandler}" style="display: inline-block; background: #2c7777; color: white; padding: 12px 28px; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;">Share with a Friend</a></div></div>`;
}
