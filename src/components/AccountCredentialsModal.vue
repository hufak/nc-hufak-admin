<script setup lang="ts">
import { styles } from '../styles';
</script>

<template>
	<div :style="styles.modalBackdrop" role="presentation" @mousedown="$emit('close')">
		<div :style="styles.modalCard" @mousedown.stop>
			<slot />
		</div>
	</div>
</template>
