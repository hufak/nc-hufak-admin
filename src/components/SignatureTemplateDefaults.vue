<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { serializeSignatureMarkup, splitSignatureMarkup } from '../utils/signatureUtils';
import SignatureMarkupEditor from './SignatureMarkupEditor.vue';
import SettingEditorActions from './SettingEditorActions.vue';
import type { SignatureTemplateResponse } from '../types';

const template = ref('');
const useHtmlSignature = ref(false);
const initialTemplate = ref('');
const initialUseHtmlSignature = ref(false);
const defaultTemplate = ref('');
const loading = ref(true);
const saving = ref(false);
const status = ref('');

const hasTextareaChanges = computed(() => template.value !== initialTemplate.value || useHtmlSignature.value !== initialUseHtmlSignature.value);

onMounted(async () => {
	try {
		const templateData = await apiRequest<SignatureTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/signature-template'),
		);
		const rawTemplate = typeof templateData.template === 'string' ? templateData.template : '';
		const { text, useHtml } = splitSignatureMarkup(rawTemplate);
		template.value = text;
		useHtmlSignature.value = useHtml;
		initialTemplate.value = text;
		initialUseHtmlSignature.value = useHtml;
		defaultTemplate.value = typeof templateData.defaultTemplate === 'string' ? templateData.defaultTemplate : rawTemplate;
		status.value = '';
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : 'Failed to load template'}`;
	} finally {
		loading.value = false;
	}
});

const saveTemplate = async () => {
	saving.value = true;
	status.value = 'Saving template...';
	try {
		const body = new URLSearchParams({
			template: serializeSignatureMarkup(template.value, useHtmlSignature.value),
		});
		const data = await apiRequest<SignatureTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/signature-template'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		initialTemplate.value = template.value;
		initialUseHtmlSignature.value = useHtmlSignature.value;
		status.value = data.message || 'Signature template saved';
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : 'Failed to save template'}`;
	} finally {
		saving.value = false;
	}
};

const resetTemplate = () => {
	template.value = initialTemplate.value;
	useHtmlSignature.value = initialUseHtmlSignature.value;
	status.value = '';
};

const loadDefaultTemplate = () => {
	const { text, useHtml } = splitSignatureMarkup(defaultTemplate.value);
	template.value = text;
	useHtmlSignature.value = useHtml;
	status.value = '';
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Signature template</h2>
		</div>
		<form :style="styles.form" @submit.prevent="saveTemplate">
			<SignatureMarkupEditor
				:text="template"
				:use-html="useHtmlSignature"
				:disabled="loading || saving"
				:textarea-style="styles.templateBox"
				placeholder="Enter signature template..."
				@update:text="template = $event"
				@update:use-html="useHtmlSignature = $event" />
			<SettingEditorActions save-label="Save signature template" :loading="loading" :saving="saving" :has-changes="hasTextareaChanges" @reset="resetTemplate" @load-defaults="loadDefaultTemplate" />
			<p v-if="status" :style="styles.successMessage">{{ status }}</p>
		</form>
	</section>
</template>
