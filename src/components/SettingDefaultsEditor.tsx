import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { SECTION_KEYS, buildSectionUrl, updateUrlSection } from '../constants';

interface SettingDefaultsEditorProps {
	title: string
	settingName: string
	url: string
	payloadKey: string
	readValue: (data: Record<string, unknown>) => string
	validate: (value: string) => string
	placeholder: string
	rows?: number
}

function SettingDefaultsEditor({
	title,
	settingName,
	url,
	payloadKey,
	readValue,
	validate,
	placeholder,
	rows = 20,
}: SettingDefaultsEditorProps): ReactElement {
	const [value, setValue] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');
	const validationMessage = validate(value);
	const canSave = !loading && !saving && validationMessage === '';

	useEffect(() => {
		async function loadValue() {
			setLoading(true);
			try {
				const data = await apiRequest<Record<string, unknown>>(OC.generateUrl(url));
				setValue(readValue(data));
				setStatus('');
			} catch (err) {
				setStatus(
					`Error: ${err instanceof Error ? err.message : `Failed to load ${settingName}`}`,
				);
			} finally {
				setLoading(false);
			}
		}

		loadValue();
		// the editor is remounted per section, the endpoint never changes while mounted
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [url]);

	const save = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const error = validate(value);
		if (error !== '') {
			setStatus(`Error: ${error}`);
			return;
		}
		setSaving(true);
		setStatus(`Saving ${settingName}...`);
		try {
			const body = new URLSearchParams({ [payloadKey]: value });
			const data = await apiRequest<Record<string, unknown>>(OC.generateUrl(url), {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			});
			const savedValue = readValue(data);
			setValue(savedValue === '' ? value : savedValue);
			setStatus(
				typeof data.message === 'string' && data.message !== ''
					? data.message
					: `${settingName} saved`,
			);
		} catch (err) {
			setStatus(
				`Error: ${err instanceof Error ? err.message : `Failed to save ${settingName}`}`,
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<div style={styles.proseContent}>
				<h2>{title}</h2>
				<p style={styles.introText}>
					Changes to this setting only apply to newly created accounts. To roll them
					out to existing accounts, apply the {settingName} per account in the{' '}
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
					. Note that this overrides any changes those users may have made
					themselves.
				</p>
			</div>
			<form onSubmit={save} style={styles.form}>
				<textarea
					value={value}
					onChange={(event) => setValue(event.target.value)}
					style={{ ...styles.templateBox, fontFamily: 'monospace' }}
					placeholder={placeholder}
					disabled={loading}
					rows={rows}
				/>
				{validationMessage && <p style={styles.validationMessage}>{validationMessage}</p>}
				<button type="submit" disabled={!canSave} style={styles.submitButton}>
					{saving ? 'Saving...' : `Save ${settingName}`}
				</button>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

export { SettingDefaultsEditor };
