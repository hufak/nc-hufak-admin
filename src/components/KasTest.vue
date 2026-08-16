<script setup lang="ts">
import { computed, ref } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { KasMailAccountsResponse, KasTestResponse } from '../types';
import AccountCredentialsModal from './AccountCredentialsModal.vue';
import KasResponseTable from './KasResponseTable.vue';

const isTesting = ref(false);
const isLoadingAccounts = ref(false);
const credentialsModalOpen = ref(false);
const credentialsAction = ref<'test' | 'accounts'>('test');
const temporaryKasLogin = ref('');
const temporaryKasPassword = ref('');
const result = ref<KasTestResponse | null>(null);
const mailAccounts = ref<KasMailAccountsResponse | null>(null);
const error = ref('');

const hasTemporaryCredentials = computed(() =>
	temporaryKasLogin.value.trim() !== '' && temporaryKasPassword.value !== '',
);

type KasCredentials = { login: string; password: string };

const closeCredentialsModal = () => {
	credentialsModalOpen.value = false;
	temporaryKasLogin.value = '';
	temporaryKasPassword.value = '';
};

const openCredentialsModal = (action: 'test' | 'accounts') => {
	credentialsAction.value = action;
	credentialsModalOpen.value = true;
};

const requestBody = (credentials?: KasCredentials) => {
	const body = new URLSearchParams();
	if (credentials) {
		body.set('kasLogin', credentials.login);
		body.set('kasPassword', credentials.password);
	}
	return body;
};

const useTemporaryCredentials = () => {
	if (!hasTemporaryCredentials.value) {
		return;
	}
	const credentials: KasCredentials = {
		login: temporaryKasLogin.value.trim(),
		password: temporaryKasPassword.value,
	};
	closeCredentialsModal();
	if (credentialsAction.value === 'accounts') {
		void loadMailAccounts(credentials, false);
	} else {
		void runTest(credentials, false);
	}
};

const runTest = async (credentials?: KasCredentials, promptOnFailure = true) => {
	isTesting.value = true;
	result.value = null;
	mailAccounts.value = null;
	error.value = '';
	try {
		result.value = await apiRequest<KasTestResponse>(
			OC.generateUrl('/apps/hufak/api/kas/test'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: requestBody(credentials),
			},
		);
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'KAS connection test failed';
		if (promptOnFailure) openCredentialsModal('test');
	} finally {
		isTesting.value = false;
	}
};

const loadMailAccounts = async (credentials?: KasCredentials, promptOnFailure = true) => {
	isLoadingAccounts.value = true;
	result.value = null;
	mailAccounts.value = null;
	error.value = '';
	try {
		mailAccounts.value = await apiRequest<KasMailAccountsResponse>(
			OC.generateUrl('/apps/hufak/api/kas/mail-accounts'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: requestBody(credentials),
			},
		);
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load KAS email accounts';
		if (promptOnFailure) openCredentialsModal('accounts');
	} finally {
		isLoadingAccounts.value = false;
	}
};

</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>KAS API test</h2>
			<p :style="styles.hintText">
				Tests KAS authentication and reads account resources, domain count, and mailbox count.
			</p>
		</div>
		<div :style="styles.buttonRow">
			<button type="button" :disabled="isTesting" :style="styles.submitButton" @click="runTest()">
				{{ isTesting ? 'Loading…' : 'KAS statistics' }}
			</button>
			<button type="button" :disabled="isLoadingAccounts" :style="styles.clearButton" @click="loadMailAccounts()">
				{{ isLoadingAccounts ? 'Loading…' : 'Read all email accounts' }}
			</button>
		</div>
		<p v-if="error" :style="styles.validationMessage">{{ error }}</p>
		<div v-if="result || mailAccounts" :style="styles.fullWidthSection">
			<p>{{ mailAccounts?.message || result?.message }}</p>
			<ul :style="styles.overviewList">
				<li v-if="result">Domains: {{ result.statistics?.domainCount ?? 0 }}</li>
				<li v-if="result">Mailboxes: {{ result.statistics?.mailboxCount ?? 0 }}</li>
			</ul>
			<KasResponseTable :value="mailAccounts?.accounts ?? result?.statistics?.resources" />
		</div>

		<AccountCredentialsModal v-if="credentialsModalOpen" @close="closeCredentialsModal">
			<h4 :style="styles.modalTitle">Temporary KAS credentials</h4>
			<p :style="styles.modalText">
				The server-provided KAS credentials failed. These credentials are used for one retry only and are not stored.
			</p>
			<form :style="styles.form" autocomplete="off" @submit.prevent="useTemporaryCredentials">
				<label :style="styles.fieldLabel" for="hufak-kas-login">KAS login</label>
				<input id="hufak-kas-login" v-model="temporaryKasLogin" :style="styles.input" autocomplete="username" :disabled="isTesting">
				<label :style="styles.fieldLabel" for="hufak-kas-password">KAS password</label>
				<input id="hufak-kas-password" v-model="temporaryKasPassword" type="password" :style="styles.input" autocomplete="current-password" :disabled="isTesting">
				<div :style="styles.modalButtonRow">
					<button type="submit" :disabled="!hasTemporaryCredentials" :style="styles.submitButton">{{ credentialsAction === 'accounts' ? 'Read email accounts' : 'Load statistics' }}</button>
					<button type="button" :style="styles.clearButton" @click="closeCredentialsModal">Cancel</button>
				</div>
			</form>
		</AccountCredentialsModal>
	</section>
</template>
