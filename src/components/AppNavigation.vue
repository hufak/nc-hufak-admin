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
						:icon="entry.iconPath ? '' : entry.icon"
						:href="entry.href"
						:active="entry.key === activeKey"
						@click="$event.preventDefault(); emit('select', entry.key)">
						<template v-if="entry.iconPath" #icon>
							<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
								<path fill="currentColor" :d="entry.iconPath" />
							</svg>
						</template>
					</NcAppNavigationItem>
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
