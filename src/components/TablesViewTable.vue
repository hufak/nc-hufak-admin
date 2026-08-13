<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { styles } from '../styles';
import { fetchViewData } from '../utils/tablesView';
import type { TableViewRow } from '../utils/tablesView';
import type { TablesColumn } from '../types';

/** One read-only rendering of a Nextcloud Tables view, printable onto A4. */
const props = defineProps<{
	viewId: number
	/** heading of the printout; the table itself is rendered without it */
	title: string
	/** the view's own description, in Markdown */
	description?: string
}>();

/** Descriptions are Markdown, so they are rendered the way the rest of
 * Nextcloud renders Markdown. The renderer is a heavy dependency, hence its own
 * chunk: it is fetched when such a page is opened, not with the main bundle. */
const NcRichText = defineAsyncComponent(async () =>
	(await import(/* webpackChunkName: "richtext" */ '../richtext')).NcRichText);

/** The printed lists leave the house, so their heading names the body they
 * belong to rather than just the view. */
const PRINT_TITLE_PREFIX = 'Hufak(ÖH)';

const descriptionStyle: CSSProperties = {
	...styles.hintText,
	maxWidth: '72ch',
	marginBottom: '4px',
};

const columns = ref<TablesColumn[]>([]);
const rows = ref<TableViewRow[]>([]);
const error = ref('');
const loading = ref(true);
const descriptionElement = ref<HTMLElement | null>(null);

const load = async () => {
	loading.value = true;
	error.value = '';
	try {
		const data = await fetchViewData(props.viewId);
		columns.value = data.columns;
		rows.value = data.rows;
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load this list';
	} finally {
		loading.value = false;
	}
};

onMounted(load);
watch(() => props.viewId, load);

const escapeHtml = (value: string) =>
	value.replace(/[&<>"]/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
	}[character] ?? character));

const printedOn = () => new Date().toLocaleDateString('de-AT', {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

/** The rendered description on the page doubles as the one for print: the print
 * document is a bare iframe, so it gets the Markdown that NcRichText already
 * turned into HTML here rather than a second renderer of its own. Falls back to
 * the raw Markdown while the renderer chunk is still on its way, so a
 * description never goes missing from a printout. */
const printedDescription = () => {
	const description = props.description ?? '';
	if (description === '') {
		return '';
	}
	const rendered = descriptionElement.value?.innerHTML ?? '';
	return `<div class="description">${rendered === '' ? escapeHtml(description) : rendered}</div>`;
};

/** Standalone A4 document: it is printed from an off-screen iframe, so none of
 * the Nextcloud page styles reach it and the layout below is all there is. */
const buildPrintDocument = () => {
	const heading = `${PRINT_TITLE_PREFIX} ${props.title}`;
	return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(heading)} ${escapeHtml(printedOn())}</title>
<style>
@page { size: A4 portrait; margin: 18mm 16mm; }
html, body { margin: 0; padding: 0; }
body {
	background: #fff;
	color: #000;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
	font-size: 10.5pt;
	line-height: 1.35;
}
h1 { font-size: 16pt; margin: 0 0 1mm; }
p.meta { font-size: 9pt; color: #555; margin: 0 0 6mm; }
/* the rendered Markdown of the view description, lifted from the page */
.description { font-size: 10pt; margin: 0 0 1mm; }
.description p, .description ul, .description ol { margin: 0 0 1.5mm; }
.description ul, .description ol { padding-left: 6mm; }
.description h1, .description h2, .description h3,
.description h4, .description h5, .description h6 {
	font-size: 11pt;
	margin: 0 0 1mm;
}
.description a { color: #000; text-decoration: underline; }
.description code, .description pre { font-family: monospace; font-size: 9.5pt; }
.description pre { white-space: pre-wrap; margin: 0 0 1.5mm; }
.description blockquote {
	margin: 0 0 1.5mm;
	padding-left: 3mm;
	border-left: 0.5pt solid #999;
	color: #333;
}
table { width: 100%; border-collapse: collapse; }
th, td {
	border: 0.5pt solid #666;
	padding: 1.6mm 2.4mm;
	text-align: left;
	vertical-align: top;
}
th { background: #eee; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
/* repeat the header on every sheet and never split a row across two */
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<h1>${escapeHtml(heading)}</h1>
${printedDescription()}
<p class="meta">Stand: ${escapeHtml(printedOn())} — ${rows.value.length} Einträge</p>
<table>
<thead><tr>${columns.value.map((column) => `<th>${escapeHtml(column.title ?? '')}</th>`).join('')}</tr></thead>
<tbody>
${rows.value.map((row) => `<tr>${row.cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</body>
</html>`;
};

/** Hands the A4 document to the browser's print dialog, where "Save as PDF" is
 * the destination that writes it to disk. Rendering PDFs ourselves would mean
 * bundling a PDF library for lists that are printed on paper just as often. */
const print = () => {
	const frame = document.createElement('iframe');
	frame.setAttribute('aria-hidden', 'true');
	frame.style.position = 'fixed';
	frame.style.right = '0';
	frame.style.bottom = '0';
	frame.style.width = '0';
	frame.style.height = '0';
	frame.style.border = '0';
	document.body.appendChild(frame);

	const frameDocument = frame.contentDocument;
	const frameWindow = frame.contentWindow;
	if (!frameDocument || !frameWindow) {
		frame.remove();
		error.value = 'Could not open the print view';
		return;
	}

	// the frame is dropped once the dialog closes; the timeout covers browsers
	// that never fire afterprint
	let removed = false;
	const removeFrame = () => {
		if (!removed) {
			removed = true;
			frame.remove();
		}
	};
	frameWindow.addEventListener('afterprint', removeFrame);
	window.setTimeout(removeFrame, 60000);

	frameDocument.open();
	frameDocument.write(buildPrintDocument());
	frameDocument.close();

	// let the fresh document lay out before the dialog snapshots it
	window.setTimeout(() => {
		frameWindow.focus();
		frameWindow.print();
	}, 100);
};

const canPrint = () => !loading.value && error.value === '' && columns.value.length > 0;

defineExpose({ print, canPrint });
</script>

<template>
	<div>
		<div v-if="description" ref="descriptionElement" :style="descriptionStyle">
			<NcRichText :text="description" use-extended-markdown />
		</div>
		<p v-if="loading" :style="styles.hintText">Loading…</p>
		<p v-else-if="error" :style="styles.validationMessage">Failed to load this list: {{ error }}</p>
		<p v-else-if="rows.length === 0" :style="styles.hintText">This view has no rows yet.</p>
		<div v-else :style="styles.tableWrapper">
			<table :style="styles.table">
				<thead>
					<tr>
						<th v-for="column in columns" :key="column.id" :style="styles.tableHeader">
							{{ column.title }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="row in rows" :key="row.id">
						<td v-for="(cell, index) in row.cells" :key="index" :style="styles.tableCell">
							{{ cell }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
