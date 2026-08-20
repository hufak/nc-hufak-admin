<script setup lang="ts">
import { styles } from '../styles';

defineProps<{
	saveLabel: string
	loading: boolean
	saving: boolean
	hasChanges: boolean
	canSave?: boolean
}>();

const emit = defineEmits<{
	(event: 'reset'): void
	(event: 'loadDefaults'): void
}>();
</script>

<template>
	<div :style="styles.buttonRow">
		<button type="submit" :disabled="loading || saving || !hasChanges || canSave === false" :style="styles.submitButton">
			{{ saving ? 'Saving...' : saveLabel }}
		</button>
		<button type="button" :disabled="loading || saving || !hasChanges" :style="styles.clearButton" @click="emit('reset')">Reset</button>
		<button type="button" :disabled="loading || saving" :style="styles.clearButton" @click="emit('loadDefaults')">Load defaults</button>
	</div>
</template>
