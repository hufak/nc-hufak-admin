import type { ReactElement } from 'react';
import { styles } from '../styles';

interface SignaturePreviewProps {
	signature: string
}

function SignaturePreview({ signature }: SignaturePreviewProps): ReactElement {
	if (signature.startsWith(':HTML:')) {
		const htmlContent = signature
			.slice(6)
			.replace(/\r\n/g, '\n')
			.replace(/\n/g, '<br>');
		return (
			<div
				className="hufak-signature-preview-html"
				style={styles.signaturePreviewHtml}
				dangerouslySetInnerHTML={{ __html: htmlContent }}
			/>
		);
	}

	return (
		<pre style={styles.signaturePreviewPre}>
			{signature.trim() === '' ? 'No signature' : signature}
		</pre>
	);
}

export { SignaturePreview };
