<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { styles } from '../styles';

/** The student stats app is a separate React application (studentstats2025).
 * It is kept as-is and loaded on demand into its own bundle chunk, so React
 * only reaches the browser when this section is opened. */
const container = ref<HTMLDivElement | null>(null);
const error = ref('');
let unmountReactApp: (() => void) | null = null;

onMounted(async () => {
	try {
		const { mountStudentStats } = await import(
			/* webpackChunkName: "studentstats" */ '../studentstats/mount'
		);
		if (container.value) {
			unmountReactApp = mountStudentStats(container.value);
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load student stats';
	}
});

onBeforeUnmount(() => {
	unmountReactApp?.();
	unmountReactApp = null;
});
</script>

<template>
	<p v-if="error" :style="styles.validationMessage">Failed to load student stats: {{ error }}</p>
	<div ref="container" />
</template>
