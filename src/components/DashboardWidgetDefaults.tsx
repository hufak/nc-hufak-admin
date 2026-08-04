import type { ReactElement } from 'react';
import { SettingDefaultsEditor } from './SettingDefaultsEditor';

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

function DashboardWidgetDefaults(): ReactElement {
	return (
		<SettingDefaultsEditor
			title="Nextcloud dashboard widgets"
			settingName="dashboard widgets"
			url="/apps/hufak/api/settings/dashboard-layout"
			payloadKey="dashboardLayout"
			readValue={(data) =>
				typeof data.dashboardLayout === 'string' ? data.dashboardLayout : ''
			}
			validate={getWidgetLayoutValidationMessage}
			placeholder="Comma-separated widget ids, e.g. recommendations,calendar,mail"
			rows={6}
		/>
	);
}

export { DashboardWidgetDefaults };
