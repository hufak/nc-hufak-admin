import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import {
	serializeSignatureMarkup,
	splitSignatureMarkup,
} from '../utils/signatureUtils';
import { SignatureMarkupEditor } from './SignatureMarkupEditor';
import type { SignatureTemplateResponse } from '../types';

function SignatureTemplateDefaults(): ReactElement {
	const [template, setTemplate] = useState('');
	const [useHtmlSignature, setUseHtmlSignature] = useState(false);
	const [initialTemplate, setInitialTemplate] = useState('');
	const [initialUseHtmlSignature, setInitialUseHtmlSignature] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadTemplate() {
			try {
				const templateData = await apiRequest<SignatureTemplateResponse>(
					OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				);
				const rawTemplate =
					typeof templateData.template === 'string' ? templateData.template : '';
				const { text, useHtml } = splitSignatureMarkup(rawTemplate);
				setTemplate(text);
				setUseHtmlSignature(useHtml);
				setInitialTemplate(text);
				setInitialUseHtmlSignature(useHtml);
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
			const serializedTemplate = serializeSignatureMarkup(template, useHtmlSignature);
			const body = new URLSearchParams({ template: serializedTemplate });
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
			setInitialTemplate(template);
			setInitialUseHtmlSignature(useHtmlSignature);
			setStatus(data.message || 'Signature template saved');
		} catch (err) {
			setStatus(`Error: ${err instanceof Error ? err.message : 'Failed to save template'}`);
		} finally {
			setSaving(false);
		}
	};

	const hasTextareaChanges = template !== initialTemplate;

	return (
		<section style={styles.formSection}>
			<div style={styles.proseContent}>
				<h2>Signature template</h2>
			</div>
			<form onSubmit={saveTemplate} style={styles.form}>
				<SignatureMarkupEditor
					text={template}
					useHtml={useHtmlSignature}
					onTextChange={setTemplate}
					onUseHtmlChange={setUseHtmlSignature}
					disabled={loading || saving}
					textareaStyle={styles.templateBox}
					placeholder="Enter signature template..."
				/>
				<div style={styles.buttonRow}>
					<button
						type="submit"
						disabled={loading || saving || !hasTextareaChanges}
						style={styles.submitButton}
					>
						{saving ? 'Saving...' : 'Save signature template'}
					</button>
					<button
						type="button"
						disabled={loading || saving}
						style={styles.clearButton}
						onClick={() => {
							setTemplate(initialTemplate);
							setUseHtmlSignature(initialUseHtmlSignature);
							setStatus('');
						}}
					>
						Reset
					</button>
				</div>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

export { SignatureTemplateDefaults };
