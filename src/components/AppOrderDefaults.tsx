import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { SECTION_KEYS, buildSectionUrl, updateUrlSection } from '../constants';
import type { ApporderSettingsResponse } from '../types';

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
	const [apporder, setApporder] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');
	const validationMessage = getJsonValidationMessage(apporder);
	const canSave = !loading && !saving && validationMessage === '';

	useEffect(() => {
		async function loadApporder() {
			try {
				const apporderData = await apiRequest<ApporderSettingsResponse>(
					OC.generateUrl('/apps/hufak/api/settings/apporder'),
				);
				setApporder(typeof apporderData.apporder === 'string' ? apporderData.apporder : '');
				setStatus('');
			} catch (err) {
				setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to load app order'}`);
			} finally {
				setLoading(false);
			}
		}

		loadApporder();
	}, []);

	const saveApporder = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const jsonError = getJsonValidationMessage(apporder);
		if (jsonError !== '') {
			setStatus(`Error: ${jsonError}`);
			return;
		}
		setSaving(true);
		setStatus('Saving app order...');
		try {
			const body = new URLSearchParams({ apporder });
			const data = await apiRequest<ApporderSettingsResponse>(
				OC.generateUrl('/apps/hufak/api/settings/apporder'),
				{
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			setApporder(typeof data.apporder === 'string' ? data.apporder : apporder);
			setStatus(data.message || 'Apporder saved');
		} catch (err) {
			setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to save apporder'}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<div style={styles.proseContent}>
				<h2>Nextcloud app order</h2>
				<p style={styles.introText}>
					Changes to this setting only apply to newly created accounts. To roll them
					out to existing accounts, apply the default app order per account in the{' '}
					<a
						href={buildSectionUrl(SECTION_KEYS.ACCOUNT_OVERVIEW)}
						onClick={(event) => {
							event.preventDefault();
							updateUrlSection(SECTION_KEYS.ACCOUNT_OVERVIEW);
							window.dispatchEvent(new PopStateEvent('popstate'));
						}}
						style={styles.inlineLink}
					>
						account overview
					</a>
					. Note that this overrides any app order changes those users may have made
					themselves.
				</p>
			</div>
			<form onSubmit={saveApporder} style={styles.form}>
				<textarea
					value={apporder}
					onChange={(event) => setApporder(event.target.value)}
					style={{ ...styles.templateBox, fontFamily: 'monospace' }}
					placeholder="Enter apporder JSON..."
					disabled={loading}
					rows={20}
				/>
				{validationMessage && <p style={styles.validationMessage}>{validationMessage}</p>}
				<button type="submit" disabled={!canSave} style={styles.submitButton}>
					{saving ? 'Saving...' : 'Save app order'}
				</button>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

export { AppOrderDefaults };
