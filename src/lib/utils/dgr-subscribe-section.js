/**
 * Generate a full-width Subscribe section that breaks out of WordPress containers
 * Uses negative margins technique for maximum compatibility
 */

export function generateSubscribeSection(options = {}) {
  const {
    title = 'Subscribe to Daily Gospel Reflections',
    subtitle = 'Sent directly to your email inbox, every morning.',
    buttonText = 'Subscribe',
    buttonUrl = 'https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g',
    gradientStart = '#0fa3a3',
    gradientEnd = '#2c7777'
  } = options;

  // Return everything on a single line to prevent WordPress from adding <br> tags
  return `<!-- Subscribe Section - Full Width on WordPress --><div style="margin-left: calc(-50vw + 50%); margin-right: calc(-50vw + 50%); background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%); padding-top: 50px; padding-bottom: 50px; margin-top: 50px; margin-bottom: 0; text-align: center; width: auto; max-width: none; overflow-x: hidden;"><div style="max-width: 600px; margin: 0 auto; padding: 0 20px;"><h3 style="font-family: 'PT Serif', Georgia, serif; font-size: 28px; font-weight: 700; color: white; margin: 0 0 15px; line-height: 1.3;">${title}</h3><p style="font-size: 16px; color: white; margin: 0 0 30px; opacity: 0.95; line-height: 1.5;">${subtitle}</p><a href="${buttonUrl}" target="_blank" style="display: inline-block; background: white; color: ${gradientEnd}; padding: 14px 35px; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 5px; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.1); white-space: nowrap;" onmouseover="this.style.opacity='0.9'; this.style.transform='translateY(-1px)'" onmouseout="this.style.opacity='1'; this.style.transform='translateY(0)'">${buttonText}</a></div></div>`;
}

/**
 * Template helper for Subscribe section
 * Use in templates as: {{subscribeSection}}
 */
export function processSubscribeHelper(template) {
  return template.replace(/{{subscribeSection}}/g, () => {
    return generateSubscribeSection();
  });
}

/**
 * Get WordPress-compatible full-width wrapper styles
 */
export function getFullWidthStyles() {
  return `
    margin-left: calc(-50vw + 50%);
    margin-right: calc(-50vw + 50%);
    padding-left: calc(50vw - 50%);
    padding-right: calc(50vw - 50%);
    width: auto;
    max-width: none;
  `;
}