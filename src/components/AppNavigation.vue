<script setup lang="ts">
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation';
import NcAppNavigationCaption from '@nextcloud/vue/components/NcAppNavigationCaption';
import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem';
import NcAppNavigationList from '@nextcloud/vue/components/NcAppNavigationList';

import type { NavigationGroup } from './navigationTypes';

defineProps<{
	navigationLabel: string
	groups: NavigationGroup[]
	activeKey: string
	footer?: string
}>();

const emit = defineEmits<{ (event: 'select', key: string): void }>();
</script>

<template>
	<NcAppNavigation :aria-label="navigationLabel">
		<template #list>
			<NcAppNavigationList>
				<template v-for="(group, groupIndex) in groups" :key="`group-${groupIndex}`">
					<NcAppNavigationCaption v-if="group.label" :name="group.label" />
					<NcAppNavigationItem
						v-for="entry in group.entries"
						:key="entry.key"
						:name="entry.name"
						:icon="entry.icon"
						:href="entry.href"
						:active="entry.key === activeKey"
						@click="$event.preventDefault(); emit('select', entry.key)" />
				</template>
			</NcAppNavigationList>
		</template>
		<template v-if="footer" #footer>
			<p class="hufak-navigation-footer">{{ footer }}</p>
		</template>
	</NcAppNavigation>
</template>

<style scoped>
.hufak-navigation-footer {
	color: var(--color-error);
	padding: 0 12px 12px;
}
</style>
