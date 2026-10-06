import type { Component } from 'svelte';
import { getPublicPageTheme } from './themes';
import type { PublicPageTheme } from './theme';
import { design as alivingunion } from './alivingunion';

/**
 * A course's design for its public guide pages. Everything is optional: a part
 * that is not overridden renders the standard way. See README.md in this folder.
 */
export interface PublicGuideDesign {
	components?: {
		/**
		 * Decoration behind the page content, e.g. artwork in the margin. Positioned by the
		 * component itself; rendered on the landing and session pages, not in print.
		 * Props: course, module, session (absent on the landing page)
		 */
		Backdrop?: Component<any>;
		/** Top of the guide's landing page, replacing the eyebrow, title and rule. Props: course, module, sessions */
		LandingHero?: Component<any>;
		/**
		 * Top of a session, replacing the eyebrow, title and rule — on the session page and
		 * at the start of each session in the print version. Props: course, module, session, print
		 */
		SessionHeader?: Component<any>;
		/** The landing page's list of sessions, replacing the heading and cards. Props: course, module, groups */
		SessionList?: Component<any>;
		/** First thing in the whole-guide print version / PDF. Props: course, module, sessions */
		PrintCover?: Component<any>;
	};
	/**
	 * Components keyed by block type. Restyle a standard block ('quote', 'summary', …)
	 * or add a block type of the course's own. Props: block, print
	 */
	blocks?: Record<string, Component<any>>;
}

const DESIGNS: Record<string, PublicGuideDesign> = {
	alivingunion
};

export interface ResolvedGuideDesign {
	theme: PublicPageTheme;
	components: NonNullable<PublicGuideDesign['components']>;
	blocks: Record<string, Component<any>>;
}

export function getPublicGuideDesign(courseSlug: string): ResolvedGuideDesign {
	const design = DESIGNS[courseSlug];
	return {
		theme: getPublicPageTheme(courseSlug),
		components: design?.components ?? {},
		blocks: design?.blocks ?? {}
	};
}
