import type { PublicGuideDesign } from '..';
import Backdrop from './Backdrop.svelte';
import LandingHero from './LandingHero.svelte';
import PrintCover from './PrintCover.svelte';
import SessionHeader from './SessionHeader.svelte';
import SessionList from './SessionList.svelte';
import Illustration from './blocks/Illustration.svelte';
import Questions from './blocks/Questions.svelte';
import Quote from './blocks/Quote.svelte';
import Scripture from './blocks/Scripture.svelte';
import Summary from './blocks/Summary.svelte';
import Themes from './blocks/Themes.svelte';
import Title from './blocks/Title.svelte';

// Editorial print is the reference: flat colour, ruled bands, highlighter tags and
// small ink illustrations, with no shadows, gradients or rounded cards.
export const design: PublicGuideDesign = {
	components: { Backdrop, LandingHero, SessionHeader, SessionList, PrintCover },
	blocks: {
		title: Title,
		summary: Summary,
		accordion: Themes,
		questions: Questions,
		scripture: Scripture,
		quote: Quote,
		illustration: Illustration
	}
};
