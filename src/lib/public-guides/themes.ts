import { DEFAULT_THEME, type PublicPageTheme } from './theme';
import { theme as alivingunion } from './alivingunion/theme';

// Data-only half of the guide registry (no Svelte components), so server code such
// as the PDF builder can read a course's theme without importing its design.

/**
 * `version` goes into the PDF content hash. Bump it when a course's components or
 * block overrides change how the print version looks, so its PDFs are rebuilt.
 * (Theme changes are picked up automatically.)
 */
const GUIDES: Record<string, { theme: PublicPageTheme; version: number }> = {
	alivingunion: { theme: alivingunion, version: 1 }
};

export function getPublicPageTheme(courseSlug: string): PublicPageTheme {
	return GUIDES[courseSlug]?.theme ?? DEFAULT_THEME;
}

export function getPublicGuideVersion(courseSlug: string): number {
	return GUIDES[courseSlug]?.version ?? 0;
}
