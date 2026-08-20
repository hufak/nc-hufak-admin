<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, type CSSProperties } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard';
import SettingEditorActions from './SettingEditorActions.vue';
import type { NewAccountInfoTemplateResponse } from '../types';
import { replaceNewAccountTemplateVariables } from '../utils/newAccountTemplate';

const template = ref('');
const initialTemplate = ref('');
const defaultTemplate = ref('');
const loading = ref(true);
const saving = ref(false);
const status = ref('');
const templateTextareaStyle = { ...styles.templateBox, fontFamily: 'monospace', height: '100%' };
const NcRichText = defineAsyncComponent(async () =>
	(await import(/* webpackChunkName: 'richtext' */ '../richtext')).NcRichText);
const previewValues = {
	user_name: 'Alex Example',
	cloud_url: 'https://cloud.hufak.net',
	login_email: 'alex.example@hufak.net',
	cloud_password: 'example-password',
	private_email: 'alex@example.org',
	imap_server: 'w00ccd84.kasserver.com',
	imap_port: '993',
	smtp_server: 'w00ccd84.kasserver.com',
	smtp_port: '465',
	creation_log: 'Example account creation completed successfully.',
	email_account_status: 'A new Hufak email mailbox was created.',
	mailbox_username: 'alex.example@hufak.net',
	mailbox_password: 'example-mailbox-password',
	shared_accounts: 'department@example.hufak.net',
};
const previewMarkdown = computed(() =>
	replaceNewAccountTemplateVariables(template.value, previewValues));
const editorLayoutStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 36ch), 1fr))',
	gap: '16px',
	alignItems: 'stretch',
};
const previewStyle: CSSProperties = {
	border: '1px solid var(--color-border)',
	borderRadius: '8px',
	padding: '10px 12px',
	minHeight: '420px',
	boxSizing: 'border-box',
	background: 'var(--color-main-background)',
};

const hasChanges = computed(() => template.value !== initialTemplate.value);

onMounted(async () => {
	try {
		const data = await apiRequest<NewAccountInfoTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/new-account'),
		);
		template.value = typeof data.template === 'string' ? data.template : '';
		initialTemplate.value = template.value;
		defaultTemplate.value = typeof data.defaultTemplate === 'string' ? data.defaultTemplate : template.value;
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
		const body = new URLSearchParams({ template: template.value });
		const data = await apiRequest<NewAccountInfoTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/new-account'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		initialTemplate.value = template.value;
		status.value = data.message || 'New account info template saved';
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : 'Failed to save template'}`;
	} finally {
		saving.value = false;
	}
};

const resetTemplate = () => {
	template.value = initialTemplate.value;
	status.value = '';
};

const loadDefaultTemplate = () => {
	template.value = defaultTemplate.value;
	status.value = '';
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>New account info template</h2>
			<NcNoteCard type="info">
				Markdown used for the printable account-details handout. Available placeholders include <code v-pre>{{cloud_url}}</code>, <code v-pre>{{login_email}}</code>, <code v-pre>{{cloud_password}}</code>, <code v-pre>{{private_email}}</code>, <code v-pre>{{imap_server}}</code>, <code v-pre>{{smtp_server}}</code>, and <code v-pre>{{creation_log}}</code>.
			</NcNoteCard>
		</div>
		<form :style="styles.form" @submit.prevent="saveTemplate">
			<div :style="editorLayoutStyle">
				<div>
					<textarea id="new-account-info-template-markdown" v-model="template" rows="30" :disabled="loading || saving" :style="templateTextareaStyle" aria-label="New account information Markdown template" />
				</div>
				<div>
					<div class="new-account-preview" :style="previewStyle">
						<NcRichText :key="previewMarkdown" :text="previewMarkdown" use-extended-markdown />
					</div>
				</div>
			</div>
			<SettingEditorActions save-label="Save new account info template" :loading="loading" :saving="saving" :has-changes="hasChanges" @reset="resetTemplate" @load-defaults="loadDefaultTemplate" />
			<p v-if="status" :style="styles.successMessage">{{ status }}</p>
		</form>
	</section>
</template>

<style scoped>
.new-account-preview :deep(.hljs-emphasis),
.new-account-preview :deep(em) {
	color: var(--color-main-text);
	font-style: italic;
}
</style>
