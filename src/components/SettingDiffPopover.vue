<script setup lang="ts">
import { computed } from 'vue';
import { styles } from '../styles';
import type { SettingDiffRow } from '../utils/settingDiff';

const props = defineProps<{
	title: string
	entryHeader: string
	userLabel: string
	rows: SettingDiffRow[] | null
	userRaw: string
	defaultRaw: string
	top: number
	left: number
	width: number
	margin: number
}>();

defineEmits<{ (event: 'close'): void }>();

const panelStyle = computed(() => ({
	...styles.popoverPanel,
	top: `${props.top}px`,
	left: `${props.left}px`,
	width: `${props.width}px`,
	maxHeight: `calc(100vh - ${props.top + props.margin}px)`,
}));
const legendStyle = { ...styles.hintText, marginBottom: '6px' };
const columnLabelStyle = { ...styles.hintText, marginBottom: '4px' };
</script>

<template>
	<div :style="styles.popoverBackdrop" role="presentation" @mousedown="$emit('close')" />
	<div :style="panelStyle">
		<div :style="styles.tooltipHeader">
			<strong>{{ title }}</strong>
			<button
				type="button"
				:style="styles.inlineActionButton"
				aria-label="close diff"
				title="close diff"
				@click="$emit('close')">
				<span class="icon icon-close" aria-hidden="true" :style="styles.squareIcon" />
			</button>
		</div>
		<template v-if="rows">
			<p :style="legendStyle">
				Highlighted rows differ. Entries are sorted by their position.
			</p>
			<div :style="styles.diffScroller">
				<table :style="styles.diffTable">
					<thead>
						<tr>
							<th :style="styles.diffTableHeader">{{ entryHeader }}</th>
							<th :style="styles.diffTableHeader">{{ userLabel }}</th>
							<th :style="styles.diffTableHeader">default</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in rows" :key="row.key" :style="row.differs ? styles.diffRowChanged : undefined">
							<td :style="styles.diffTableCell">{{ row.key }}</td>
							<td :style="styles.diffTableCell">{{ row.userValue ?? '—' }}</td>
							<td :style="styles.diffTableCell">{{ row.defaultValue ?? '—' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
		<div v-else :style="styles.diffColumns">
			<div>
				<p :style="columnLabelStyle">{{ userLabel }}</p>
				<pre :style="styles.tooltipPre">{{ userRaw || '(empty)' }}</pre>
			</div>
			<div>
				<p :style="columnLabelStyle">default</p>
				<pre :style="styles.tooltipPre">{{ defaultRaw || '(empty)' }}</pre>
			</div>
		</div>
	</div>
</template>
