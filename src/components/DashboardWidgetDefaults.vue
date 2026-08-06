<script setup lang="ts">
import SettingDefaultsEditor from './SettingDefaultsEditor.vue';

const WIDGET_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;

function getWidgetLayoutValidationMessage(value: string): string {
	const widgetIds = value
		.split(',')
		.map((widgetId) => widgetId.trim())
		.filter((widgetId) => widgetId !== '');
	if (widgetIds.length === 0) {
		return 'The dashboard widget layout cannot be empty.';
	}

	const invalid = widgetIds.filter((widgetId) => !WIDGET_ID_PATTERN.test(widgetId));
	if (invalid.length > 0) {
		return `Invalid widget id(s): ${invalid.join(', ')}`;
	}

	const duplicates = widgetIds.filter(
		(widgetId, index) => widgetIds.indexOf(widgetId) !== index,
	);
	if (duplicates.length > 0) {
		return `Duplicate widget id(s): ${Array.from(new Set(duplicates)).join(', ')}`;
	}

	return '';
}

const readLayout = (data: Record<string, unknown>) =>
	typeof data.dashboardLayout === 'string' ? data.dashboardLayout : '';
</script>

<template>
	<SettingDefaultsEditor
		title="Nextcloud dashboard widgets"
		setting-name="dashboard widgets"
		url="/apps/hufak/api/settings/dashboard-layout"
		payload-key="dashboardLayout"
		:read-value="readLayout"
		:validate="getWidgetLayoutValidationMessage"
		placeholder="Comma-separated widget ids, e.g. recommendations,calendar,mail"
		:rows="6" />
</template>
