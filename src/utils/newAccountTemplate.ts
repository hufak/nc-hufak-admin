export const escapeHtml = (value: string) => value
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&#039;');

export const replaceNewAccountTemplateVariables = (template: string, values: Record<string, string>) =>
	template.replace(/{{\s*([a-z_]+)\s*}}/g, (_match, key: string) => values[key] ?? '');
