<script setup lang="ts">
import SettingDefaultsEditor from './SettingDefaultsEditor.vue';
import { styles } from '../styles';

function getJsonValidationMessage(value: string): string {
	const trimmed = value.trim();
	if (trimmed === '') {
		return 'App order JSON cannot be empty.';
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch (error) {
		return error instanceof Error ? error.message : 'Invalid JSON.';
	}

	if (parsed === null || typeof parsed !== 'object') {
		return 'App order JSON must be an object or array.';
	}

	return '';
}

const readApporder = (data: Record<string, unknown>) =>
	typeof data.apporder === 'string' ? data.apporder : '';
</script>

<template>
	<SettingDefaultsEditor
		title="Nextcloud default app order"
		setting-name="app order"
		url="/apps/hufak/api/settings/apporder"
		payload-key="apporder"
		:read-value="readApporder"
		:validate="getJsonValidationMessage"
		placeholder="Enter apporder JSON...">
		<template #intro>
			<p :style="styles.introText">
				This app order only controls the order of apps in the left-side menu. The top menu order is configured in the Custom Menu app’s
				<a href="/settings/admin/side_menu" :style="styles.inlineLink">Top menu settings</a>.
				Changes here apply only to newly created accounts; applying them to existing accounts can override users’ own changes.
			</p>
		</template>
	</SettingDefaultsEditor>
</template>
