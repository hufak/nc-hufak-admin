<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { styles } from '../styles';
import { fetchViewMeta } from '../utils/tablesView';
import TablesViewTable from './TablesViewTable.vue';

/** The contact list itself, and the two key lists that are extracts of the same
 * table. All three are Tables views, so what they show is edited over there. */
const CONTACT_VIEW_ID = 36;
const KEY_LIST_VIEW_IDS = [24, 25];

/** The table all three views belong to, linked from the intro. */
const TEAM_MEMBERS_URL = 'https://cloud.hufak.net/apps/tables/#/table/26';

/** One key per list, in the order of the ids above. No emoji is defined as
 * silver or gold, but most fonts draw the old key grey and the plain one
 * yellow, which is enough to tell the two lists apart at a glance. */
const KEY_LIST_EMOJIS = ['🗝️', '🔑'];

const keyEmojiOf = (viewId: number) =>
	KEY_LIST_EMOJIS[KEY_LIST_VIEW_IDS.indexOf(viewId)] ?? '🔑';

const buttonRowStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: '10px',
	marginTop: '6px',
};

const modalCardStyle: CSSProperties = {
	...styles.modalCard,
	// only as wide as the list it shows
	width: 'fit-content',
	maxWidth: '96vw',
	// the card itself never scrolls, so its header cannot scroll away either
	overflow: 'hidden',
	display: 'flex',
	flexDirection: 'column',
	gap: '10px',
};

const modalHeaderStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: '16px',
	flexShrink: 0,
};

/** Takes the scrolling the card gave up; the minimum lets it shrink below the
 * table's height instead of pushing the header out of the card. */
const modalBodyStyle: CSSProperties = {
	overflow: 'auto',
	minHeight: 0,
};

const modalTitleStyle: CSSProperties = {
	...styles.modalTitle,
	margin: 0,
};

const modalActionsStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: '8px',
};

const iconButtonStyle: CSSProperties = {
	...styles.clearButton,
	marginTop: 0,
	padding: '4px',
	width: '28px',
	height: '28px',
	display: 'inline-flex',
	alignItems: 'center',
	justifyContent: 'center',
};

interface ViewMeta {
	title: string
	description: string
}

/** Titles and descriptions of all three views, keyed by view id. They label the
 * key list buttons, so they are fetched up front rather than per rendering. */
const meta = reactive<Record<number, ViewMeta>>({});

const titleOf = (viewId: number, fallback: string) => meta[viewId]?.title || fallback;
const descriptionOf = (viewId: number) => meta[viewId]?.description ?? '';

onMounted(() => {
	[CONTACT_VIEW_ID, ...KEY_LIST_VIEW_IDS].forEach(async (viewId) => {
		try {
			meta[viewId] = await fetchViewMeta(viewId);
		} catch {
			// the lists render without their view's own title and description
		}
	});
});

const openKeyListId = ref<number | null>(null);
const keyListTable = ref<{ print: () => void } | null>(null);

const openKeyList = (viewId: number) => {
	openKeyListId.value = viewId;
};

const closeKeyList = () => {
	openKeyListId.value = null;
};

// the overlay covers the page, so Escape has to get out of it
const handleKeydown = (event: KeyboardEvent) => {
	if (event.key === 'Escape' && openKeyListId.value !== null) {
		closeKeyList();
	}
};

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown));

const openKeyListTitle = computed(() =>
	openKeyListId.value === null
		? ''
		: titleOf(openKeyListId.value, `Schlüsselliste ${openKeyListId.value}`),
);
</script>

<template>
	<section :style="styles.fullWidthSection">
		<div :style="styles.proseContent">
			<h2 style="margin: 0 0 6px">Contact list</h2>
			<p :style="styles.hintText">
			Taken from the
				<a :href="TEAM_MEMBERS_URL" :style="styles.inlineLink">Team members list</a>, please update any changes there and inform the secretary
			</p>
		</div>
		<TablesViewTable
			:view-id="CONTACT_VIEW_ID"
			:title="titleOf(CONTACT_VIEW_ID, 'Contact list')"
			:description="descriptionOf(CONTACT_VIEW_ID)"
			style="margin-top: 12px" />
		<h3 :style="styles.subheading">Schlüssellisten</h3>
		<div :style="buttonRowStyle">
			<button
				v-for="viewId in KEY_LIST_VIEW_IDS"
				:key="viewId"
				type="button"
				:style="styles.clearButton"
				@click="openKeyList(viewId)">
				<span aria-hidden="true">{{ keyEmojiOf(viewId) }}</span>
				{{ titleOf(viewId, `Schlüsselliste ${viewId}`) }}
			</button>
		</div>
		<div
			v-if="openKeyListId !== null"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="closeKeyList">
			<div :style="modalCardStyle" @mousedown.stop>
				<div :style="modalHeaderStyle">
					<h3 :style="modalTitleStyle">
						<span aria-hidden="true">{{ keyEmojiOf(openKeyListId) }}</span>
						{{ openKeyListTitle }}
					</h3>
					<div :style="modalActionsStyle">
						<button
							type="button"
							:style="iconButtonStyle"
							:aria-label="`Print / PDF export: ${openKeyListTitle}`"
							:title="`Print / PDF export (A4): ${openKeyListTitle}`"
							@click="keyListTable?.print()">
							<svg viewBox="0 0 24 24" aria-hidden="true" :style="styles.squareIcon">
								<path
									fill="currentColor"
									d="M18,3H6V7H18M19,12A1,1 0 0,1 18,11A1,1 0 0,1 19,10A1,1 0 0,1 20,11A1,1 0 0,1 19,12M16,19H8V14H16M19,8H5A3,3 0 0,0 2,11V17H6V21H18V17H22V11A3,3 0 0,0 19,8Z" />
							</svg>
						</button>
						<button
							type="button"
							:style="iconButtonStyle"
							aria-label="Close"
							title="Close"
							@click="closeKeyList">
							<svg viewBox="0 0 24 24" aria-hidden="true" :style="styles.squareIcon">
								<path
									fill="currentColor"
									d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
							</svg>
						</button>
					</div>
				</div>
				<div :style="modalBodyStyle">
					<TablesViewTable
						:key="openKeyListId"
						ref="keyListTable"
						:view-id="openKeyListId"
						:title="openKeyListTitle"
						:description="descriptionOf(openKeyListId)" />
				</div>
			</div>
		</div>
	</section>
</template>
