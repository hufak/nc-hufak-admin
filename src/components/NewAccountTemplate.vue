<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard';
import type { NewAccountTemplateResponse } from '../types';

const template = ref('');
const initialTemplate = ref('');
const loading = ref(true);
const saving = ref(false);
const status = ref('');
const templateTextareaStyle = { ...styles.templateBox, fontFamily: 'monospace' };

const hasChanges = computed(() => template.value !== initialTemplate.value);

onMounted(async () => {
	try {
		const data = await apiRequest<NewAccountTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/new-account'),
		);
		template.value = typeof data.template === 'string' ? data.template : '';
		initialTemplate.value = template.value;
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
		const data = await apiRequest<NewAccountTemplateResponse>(
			OC.generateUrl('/apps/hufak/api/settings/new-account'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		initialTemplate.value = template.value;
		status.value = data.message || 'Account info template saved';
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : 'Failed to save template'}`;
	} finally {
		saving.value = false;
	}
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Account info template</h2>
			<NcNoteCard type="info">
				Markdown used for the printable account-details handout. Available placeholders include <code v-pre>{{cloud_url}}</code>, <code v-pre>{{login_email}}</code>, <code v-pre>{{cloud_password}}</code>, <code v-pre>{{private_email}}</code>, <code v-pre>{{imap_server}}</code>, <code v-pre>{{smtp_server}}</code>, and <code v-pre>{{creation_log}}</code>.
			</NcNoteCard>
		</div>
		<form :style="styles.form" @submit.prevent="saveTemplate">
			<textarea v-model="template" :disabled="loading || saving" :style="templateTextareaStyle" aria-label="New account information Markdown template" />
			<div :style="styles.buttonRow">
				<button type="submit" :disabled="loading || saving || !hasChanges" :style="styles.submitButton">
					{{ saving ? 'Saving...' : 'Save account info template' }}
				</button>
				<button type="button" :disabled="loading || saving" :style="styles.clearButton" @click="template = initialTemplate; status = ''">Reset</button>
			</div>
			<p v-if="status" :style="styles.successMessage">{{ status }}</p>
		</form>
	</section>
</template>
