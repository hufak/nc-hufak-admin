<script setup lang="ts">
import SettingDefaultsEditor from './SettingDefaultsEditor.vue';

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
		title="Nextcloud app order"
		setting-name="app order"
		url="/apps/hufak/api/settings/apporder"
		payload-key="apporder"
		:read-value="readApporder"
		:validate="getJsonValidationMessage"
		placeholder="Enter apporder JSON..." />
</template>
