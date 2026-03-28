import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { styles } from '../styles';
import {
	htmlToPlainTextSignature,
	plainTextToHtmlSignature,
	serializeSignatureMarkup,
} from '../utils/signatureUtils';
import { SignaturePreview } from './SignaturePreview';

interface SignatureMarkupEditorProps {
	text: string
	useHtml: boolean
	onTextChange: (value: string) => void
	onUseHtmlChange: (value: boolean) => void
	disabled?: boolean
	textareaStyle?: CSSProperties
	textareaRows?: number
	placeholder?: string
	actions?: ReactNode
}

function SignatureMarkupEditor({
	text,
	useHtml,
	onTextChange,
	onUseHtmlChange,
	disabled = false,
	textareaStyle,
	textareaRows = 12,
	placeholder,
	actions,
}: SignatureMarkupEditorProps): ReactElement {
	return (
		<div style={styles.signatureEditorLayout}>
			<div style={styles.signatureEditorPane}>
				<textarea
					value={text}
					onChange={(event) => onTextChange(event.target.value)}
					style={textareaStyle || styles.modalTextarea}
					rows={textareaRows}
					placeholder={placeholder}
					disabled={disabled}
				/>
				<label style={styles.checkboxRow}>
					<input
						type="checkbox"
						checked={useHtml}
						onChange={(event) => {
							const nextUseHtml = event.target.checked;
							onTextChange(
								nextUseHtml ? plainTextToHtmlSignature(text) : htmlToPlainTextSignature(text),
							);
							onUseHtmlChange(nextUseHtml);
						}}
						disabled={disabled}
					/>
					<span style={styles.fieldLabel}>Use HTML signature</span>
				</label>
				{actions}
			</div>
			<div style={styles.signaturePreviewPane}>
				<SignaturePreview signature={serializeSignatureMarkup(text, useHtml)} />
			</div>
		</div>
	);
}

export { SignatureMarkupEditor };
