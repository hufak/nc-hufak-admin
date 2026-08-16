<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { styles } from '../styles';

defineProps<{ cardStyle?: CSSProperties }>();
</script>

<template>
	<div :style="styles.modalBackdrop" role="presentation" @mousedown="$emit('close')">
		<div :style="[styles.modalCard, cardStyle]" @mousedown.stop>
			<slot />
		</div>
	</div>
</template>
