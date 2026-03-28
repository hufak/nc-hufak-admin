const HTML_PREFIX = ':HTML:';

function splitSignatureMarkup(rawValue: string): { text: string; useHtml: boolean } {
	if (rawValue.startsWith(HTML_PREFIX)) {
		return {
			text: rawValue.slice(HTML_PREFIX.length),
			useHtml: true,
		};
	}

	return {
		text: rawValue,
		useHtml: false,
	};
}

function plainTextToHtmlSignature(value: string): string {
	return value.replace(/\r?\n/g, '<br>\n');
}

function htmlToPlainTextSignature(value: string): string {
	const withLineBreaks = value.replace(/<br\s*\/?>\r?\n?/gi, '\n');
	const parser = new DOMParser();
	const document = parser.parseFromString(withLineBreaks, 'text/html');
	return document.body.textContent || '';
}

function serializeSignatureMarkup(value: string, useHtml: boolean): string {
	return useHtml ? `${HTML_PREFIX}${value}` : value;
}

export {
	HTML_PREFIX,
	htmlToPlainTextSignature,
	plainTextToHtmlSignature,
	serializeSignatureMarkup,
	splitSignatureMarkup,
};
