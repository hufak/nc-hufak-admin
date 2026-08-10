<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { styles } from '../styles';

const STUDENT_LIST_ORIGIN = 'https://hufak.github.io';
const STUDENT_LIST_URL = `${STUDENT_LIST_ORIGIN}/studentlist/`;

/** Nextcloud theme values handed to the embedded app. It is a contract with
 * the studentlist repo: every token here is optional on its side, so adding
 * one never breaks an older deployment. */
const THEME_TOKENS = [
	'--color-main-background',
	'--color-main-text',
	'--color-text-maxcontrast',
	'--color-background-hover',
	'--color-border',
	'--color-primary-element',
	'--color-primary-element-text',
	'--color-error',
	'--color-success',
	'--color-warning',
	'--border-radius-element',
	'--default-clickable-area',
	'--font-face',
];

const frame = ref<HTMLIFrameElement | null>(null);

/** Height the embed reports for its own content, and the space left between the
 * top of the frame and the bottom of the viewport. The frame takes whichever is
 * larger, so it always reaches the bottom of the window and still grows with
 * content taller than that. */
const reportedHeight = ref(0);
const availableHeight = ref(600);
const frameHeight = computed(() => Math.max(reportedHeight.value, availableHeight.value));

const measureAvailableHeight = () => {
	const top = frame.value?.getBoundingClientRect().top ?? 0;
	availableHeight.value = Math.max(320, Math.floor(window.innerHeight - top));
};

const readTheme = (): Record<string, string> => {
	// Nextcloud scopes the theme the user actually picked to <body>, while the
	// media-gated default sheet can leave OS-driven values at :root — so a light
	// instance on a dark OS reads dark from <html>. Custom properties inherit,
	// so <body> also sees whatever :root defines, with its own values winning.
	const computed = getComputedStyle(document.body ?? document.documentElement);
	const theme: Record<string, string> = {};
	THEME_TOKENS.forEach((token) => {
		const value = computed.getPropertyValue(token).trim();
		if (value !== '') {
			theme[token] = value;
		}
	});
	return theme;
};

// the hash carries the theme into the first paint, so the app never flashes in
// its standalone colours before the postMessage handshake completes
const frameSrc = `${STUDENT_LIST_URL}?embed=1#theme=${encodeURIComponent(JSON.stringify(readTheme()))}`;

const sendTheme = () => {
	frame.value?.contentWindow?.postMessage(
		{ type: 'hufak:theme', theme: readTheme() },
		STUDENT_LIST_ORIGIN,
	);
};

const onMessage = (event: MessageEvent) => {
	if (event.origin !== STUDENT_LIST_ORIGIN || event.source !== frame.value?.contentWindow) {
		return;
	}
	const data = event.data as { type?: string; height?: number } | null;
	if (data?.type === 'hufak:ready') {
		sendTheme();
		return;
	}
	if (data?.type === 'hufak:height' && typeof data.height === 'number' && data.height > 0) {
		reportedHeight.value = Math.ceil(data.height);
	}
};

// Nextcloud swaps themes by toggling attributes on the root element, and the
// dark theme can also follow the OS setting
const themeObserver = new MutationObserver(sendTheme);
const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

onMounted(() => {
	window.addEventListener('message', onMessage);
	measureAvailableHeight();
	window.addEventListener('resize', measureAvailableHeight);
	const themeAttributes = { attributes: true, attributeFilter: ['class', 'data-theme', 'data-themes', 'style'] };
	themeObserver.observe(document.documentElement, themeAttributes);
	themeObserver.observe(document.body, themeAttributes);
	colorSchemeQuery.addEventListener('change', sendTheme);
});

onBeforeUnmount(() => {
	window.removeEventListener('message', onMessage);
	window.removeEventListener('resize', measureAvailableHeight);
	themeObserver.disconnect();
	colorSchemeQuery.removeEventListener('change', sendTheme);
});
</script>

<template>
	<section :style="styles.fullWidthSection">
		<div :style="styles.proseSectionContent">
			<h2>Student list</h2>
			<p :style="styles.introText">
				Filter and re-export the student list spreadsheet. This embeds the live version of
				<a :href="STUDENT_LIST_URL" target="_blank" rel="noreferrer" :style="styles.inlineLink">
					hufak.github.io/studentlist
				</a>; spreadsheets are processed in your browser and never uploaded.
			</p>
		</div>
		<iframe
			ref="frame"
			class="hufak-embed-frame"
			:src="frameSrc"
			:style="{ height: `${frameHeight}px` }"
			title="Student list"
			@load="sendTheme" />
	</section>
</template>

<style scoped>
.hufak-embed-frame {
	display: block;
	width: 100%;
	border: none;
	/* the embedded app reports its own height, so it never scrolls internally */
	overflow: hidden;
	background: transparent;
}
</style>
