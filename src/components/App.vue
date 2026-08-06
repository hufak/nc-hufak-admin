<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { apiRequest } from '../api';
import { DEFAULT_EMAIL_DOMAIN } from '../constants';
import { styles } from '../styles';
import AdminPanel from './AdminPanel.vue';
import type { AdminStatusResponse, EmailDomainResponse } from '../types';

const adminStatus = ref<'unknown' | 'admin' | 'non-admin'>('unknown');
const emailDomain = ref(DEFAULT_EMAIL_DOMAIN);
const error = ref('');

onMounted(async () => {
	try {
		const statusData = await apiRequest<AdminStatusResponse>(
			OC.generateUrl('/apps/hufak/api/admin-status'),
		);
		const admin = Boolean(statusData.isAdmin);
		adminStatus.value = admin ? 'admin' : 'non-admin';
		if (admin) {
			const domainData = await apiRequest<EmailDomainResponse>(
				OC.generateUrl('/apps/hufak/api/settings/email-domain'),
			);
			emailDomain.value = domainData.emailDomain || DEFAULT_EMAIL_DOMAIN;
		}
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Unknown error';
	}
});
</script>

<template>
	<div class="hufak-page" :style="styles.page">
		<AdminPanel
			:admin-status="adminStatus"
			:admin-status-error="error"
			:email-domain="emailDomain"
			@update:email-domain="emailDomain = $event" />
	</div>
</template>
