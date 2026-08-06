<script setup lang="ts">
import { styles } from '../styles';

defineProps<{
	/** what the setting is called in button labels, e.g. "app order" */
	settingName: string
	uid: string
	matches: boolean
	busy: boolean
	inspectExpanded: boolean
	applying: boolean
	promoting: boolean
}>();

const emit = defineEmits<{
	(event: 'inspect', anchor: HTMLElement): void
	(event: 'applyDefault'): void
	(event: 'promoteToDefault'): void
}>();
</script>

<template>
	<span
		v-if="matches"
		class="icon icon-checkmark"
		:aria-label="`${settingName} matches default`" />
	<template v-else>
		<span class="icon icon-error" :aria-label="`${settingName} differs from default`" />
		<button
			type="button"
			:style="styles.inlineActionButton"
			:aria-expanded="inspectExpanded"
			:aria-label="`inspect difference to default ${settingName}`"
			:title="`inspect difference to default ${settingName}`"
			@click="emit('inspect', $event.currentTarget as HTMLElement)">
			<span class="icon icon-toggle" aria-hidden="true" :style="styles.squareIcon" />
		</button>
		<button
			type="button"
			:disabled="busy"
			:style="styles.inlineActionButton"
			:aria-label="`apply default ${settingName}`"
			:title="`apply default ${settingName}`"
			@click="emit('applyDefault')">
			<span
				class="icon"
				:class="applying ? 'icon-loading-small' : 'icon-history'"
				aria-hidden="true"
				:style="styles.squareIcon" />
		</button>
		<button
			type="button"
			:disabled="busy"
			:style="styles.inlineActionButton"
			:aria-label="`set this user's ${settingName} as the new global default ${settingName}`"
			:title="`set ${uid}'s ${settingName} as the new global default ${settingName}`"
			@click="emit('promoteToDefault')">
			<span
				class="icon"
				:class="promoting ? 'icon-loading-small' : 'icon-upload'"
				aria-hidden="true"
				:style="styles.squareIcon" />
		</button>
	</template>
</template>
