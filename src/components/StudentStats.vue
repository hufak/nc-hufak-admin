<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { styles } from '../styles';

/** The student stats app lives in the studentstats2025 submodule, which also
 * ships standalone on stats.hufak.net. It is loaded on demand into its own
 * bundle chunk, so it only reaches the browser when this section is opened. */
const container = ref<HTMLDivElement | null>(null);
const error = ref('');
let unmountStatsApp: (() => void) | null = null;

onMounted(async () => {
	try {
		const { mountStudentStats } = await import(
			/* webpackChunkName: "studentstats" */ '../studentstats/mount'
		);
		if (container.value) {
			unmountStatsApp = await mountStudentStats(container.value);
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load student stats';
	}
});

onBeforeUnmount(() => {
	unmountStatsApp?.();
	unmountStatsApp = null;
});
</script>

<template>
	<p v-if="error" :style="styles.validationMessage">Failed to load student stats: {{ error }}</p>
	<div ref="container" />
</template>
