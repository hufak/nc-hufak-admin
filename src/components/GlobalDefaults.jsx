import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';

function GlobalDefaults() {
	const [template, setTemplate] = useState('');
	const [apporder, setApporder] = useState('');
	const [loading, setLoading] = useState(true);
	const [templateSaving, setTemplateSaving] = useState(false);
	const [apporderSaving, setApporderSaving] = useState(false);
	const [templateStatus, setTemplateStatus] = useState('');
	const [apporderStatus, setApporderStatus] = useState('');

	useEffect(() => {
		async function loadDefaults() {
			try {
				const [templateData, apporderData] = await Promise.all([
					apiRequest(OC.generateUrl('/apps/hufak/api/settings/signature-template')),
					apiRequest(OC.generateUrl('/apps/hufak/api/settings/apporder')),
				]);
				setTemplate(typeof templateData.template === 'string' ? templateData.template : '');
				setApporder(typeof apporderData.apporder === 'string' ? apporderData.apporder : '');
				setTemplateStatus('');
				setApporderStatus('');
			} catch (err) {
				setTemplateStatus(
					`Error: ${err instanceof Error ? err.message : 'Failed to load template'}`,
				);
			} finally {
				setLoading(false);
			}
		}

		loadDefaults();
	}, []);

	const saveTemplate = async (event) => {
		event.preventDefault();
		setTemplateSaving(true);
		setTemplateStatus('Saving template...');
		try {
			const body = new URLSearchParams({ template });
			const data = await apiRequest(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				{
					method: 'POST',
					headers: {
						'content-type':
							'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			setTemplateStatus(data.message || 'Signature template saved');
		} catch (err) {
			setTemplateStatus(
				`Error: ${err instanceof Error ? err.message : 'Failed to save template'}`,
			);
		} finally {
			setTemplateSaving(false);
		}
	};

	const saveApporder = async (event) => {
		event.preventDefault();
		setApporderSaving(true);
		setApporderStatus('Saving app order...');
		try {
			const body = new URLSearchParams({ apporder });
			const data = await apiRequest(OC.generateUrl('/apps/hufak/api/settings/apporder'), {
				method: 'POST',
				headers: {
					'content-type':
						'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			});
			setApporder(typeof data.apporder === 'string' ? data.apporder : apporder);
			setApporderStatus(data.message || 'Apporder saved');
		} catch (err) {
			setApporderStatus(
				`Error: ${err instanceof Error ? err.message : 'Failed to save apporder'}`,
			);
		} finally {
			setApporderSaving(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>Global defaults</h2>
			<form onSubmit={saveTemplate} style={styles.form}>
				<h3 style={styles.subheading}>Signature template</h3>
				<textarea
					value={template}
					onChange={(event) => setTemplate(event.target.value)}
					style={styles.templateBox}
					placeholder="Enter signature template..."
					disabled={loading}
				/>
				<button type="submit" disabled={loading || templateSaving} style={styles.submitButton}>
					{templateSaving ? 'Saving...' : 'Save signature template'}
				</button>
				{templateStatus && <p style={styles.successMessage}>{templateStatus}</p>}
			</form>
			<form onSubmit={saveApporder} style={styles.form}>
				<h3 style={styles.subheading}>Nextcloud app order</h3>
				<textarea
					value={apporder}
					onChange={(event) => setApporder(event.target.value)}
					style={styles.templateBox}
					placeholder="Enter apporder JSON..."
					disabled={loading}
				/>
				<button type="submit" disabled={loading || apporderSaving} style={styles.submitButton}>
					{apporderSaving ? 'Saving...' : 'Save app order'}
				</button>
				{apporderStatus && <p style={styles.successMessage}>{apporderStatus}</p>}
			</form>
		</section>
	);
}

export { GlobalDefaults };
