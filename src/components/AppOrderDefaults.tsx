import type { ReactElement } from 'react';
import { SettingDefaultsEditor } from './SettingDefaultsEditor';

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

function AppOrderDefaults(): ReactElement {
	return (
		<SettingDefaultsEditor
			title="Nextcloud app order"
			settingName="app order"
			url="/apps/hufak/api/settings/apporder"
			payloadKey="apporder"
			readValue={(data) => (typeof data.apporder === 'string' ? data.apporder : '')}
			validate={getJsonValidationMessage}
			placeholder="Enter apporder JSON..."
		/>
	);
}

export { AppOrderDefaults };
