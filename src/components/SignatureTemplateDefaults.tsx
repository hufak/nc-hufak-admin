import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { SignaturePreview } from './SignaturePreview';
import type { SignatureTemplateResponse } from '../types';

function SignatureTemplateDefaults(): ReactElement {
	const [template, setTemplate] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadTemplate() {
			try {
				const templateData = await apiRequest<SignatureTemplateResponse>(
					OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				);
				setTemplate(typeof templateData.template === 'string' ? templateData.template : '');
				setStatus('');
			} catch (err) {
				setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to load template'}`);
			} finally {
				setLoading(false);
			}
		}

		loadTemplate();
	}, []);

	const saveTemplate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		setStatus('Saving template...');
		try {
			const body = new URLSearchParams({ template });
			const data = await apiRequest<SignatureTemplateResponse>(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				{
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			setStatus(data.message || 'Signature template saved');
		} catch (err) {
			setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to save template'}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>Signature template</h2>
			<form onSubmit={saveTemplate} style={styles.form}>
				<div style={styles.signatureEditorLayout}>
					<div style={styles.signatureEditorPane}>
						<textarea
							value={template}
							onChange={(event) => setTemplate(event.target.value)}
							style={styles.templateBox}
							placeholder="Enter signature template..."
							disabled={loading}
						/>
					</div>
					<div style={styles.signaturePreviewPane}>
						<SignaturePreview signature={template} />
					</div>
				</div>
				<button type="submit" disabled={loading || saving} style={styles.submitButton}>
					{saving ? 'Saving...' : 'Save signature template'}
				</button>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

export { SignatureTemplateDefaults };
