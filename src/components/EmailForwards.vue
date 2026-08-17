<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { KasMailForwardsResponse } from '../types';
import AccountCredentialsModal from './AccountCredentialsModal.vue';
import SortableTable, { type SortableTableColumn } from './SortableTable.vue';

const loading = ref(false);
const error = ref('');
const result = ref<KasMailForwardsResponse | null>(null);
const credentialsModalOpen = ref(false);
const temporaryKasLogin = ref('');
const temporaryKasPassword = ref('');

type ForwardRow = Record<string, unknown>;
interface CompactForwardTable {
	_hufakPresentation: 'table'
	columns: string[]
	rows: ForwardRow[]
}

const forwardTable = computed<CompactForwardTable | null>(() => {
	const forwards = result.value?.forwards;
	if (forwards === null || typeof forwards !== 'object' || Array.isArray(forwards)) {
		return null;
	}
	const response = (forwards as Record<string, unknown>).Response;
	if (response === null || typeof response !== 'object' || Array.isArray(response)) {
		return null;
	}
	const table = (response as Record<string, unknown>).ReturnInfo;
	if (table === null || typeof table !== 'object' || Array.isArray(table)) {
		return null;
	}
	const candidate = table as Partial<CompactForwardTable>;
	return candidate._hufakPresentation === 'table'
		&& Array.isArray(candidate.columns)
		&& Array.isArray(candidate.rows)
		? {
			_hufakPresentation: 'table',
			columns: candidate.columns.filter((column): column is string => typeof column === 'string'),
			rows: candidate.rows.filter((row): row is ForwardRow => row !== null && typeof row === 'object' && !Array.isArray(row)),
		}
		: null;
});
const forwardColumns = computed<SortableTableColumn<ForwardRow>[]>(() =>
	forwardTable.value?.columns.map((column) => ({
		id: column,
		header: column === '_record' ? 'Record' : column,
		accessor: (row) => row[column] ?? '',
	})) ?? [],
);
const forwardsTableWrapperStyle: CSSProperties = { ...styles.tableWrapper, display: 'block', width: '100%' };
const forwardsTableStyle: CSSProperties = { ...styles.table, width: '100%', tableLayout: 'auto' };
const forwardsCellStyle: CSSProperties = {
	...styles.tableCell,
	maxWidth: '40ch',
	whiteSpace: 'normal',
	overflowWrap: 'break-word',
	wordBreak: 'normal',
};
const forwardsHeaderStyle: CSSProperties = { ...styles.tableHeader, ...forwardsCellStyle };

const requestBody = (useTemporaryCredentials = false) => {
	const body = new URLSearchParams();
	if (useTemporaryCredentials) {
		body.set('kasLogin', temporaryKasLogin.value.trim());
		body.set('kasPassword', temporaryKasPassword.value);
	}
	return body;
};

const loadForwards = async (useTemporaryCredentials = false) => {
	loading.value = true;
	error.value = '';
	result.value = null;
	try {
		result.value = await apiRequest<KasMailForwardsResponse>(
			OC.generateUrl('/apps/hufak/api/kas/mail-forwards'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: requestBody(useTemporaryCredentials),
			},
		);
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load email forwards';
		if (!useTemporaryCredentials) {
			credentialsModalOpen.value = true;
		}
	} finally {
		loading.value = false;
	}
};

const retryWithTemporaryCredentials = () => {
	if (temporaryKasLogin.value.trim() === '' || temporaryKasPassword.value === '') {
		return;
	}
	credentialsModalOpen.value = false;
	void loadForwards(true);
};

const closeCredentialsModal = () => {
	credentialsModalOpen.value = false;
	temporaryKasLogin.value = '';
	temporaryKasPassword.value = '';
};

void loadForwards();
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Email forwards</h2>
			<p :style="styles.hintText">
				All email forwards configured in KAS for the app's configured email domain.
			</p>
		</div>
		<div :style="styles.buttonRow">
			<button type="button" :disabled="loading" :style="styles.submitButton" @click="loadForwards()">
				{{ loading ? 'Loading…' : 'Reload email forwards' }}
			</button>
		</div>
		<p v-if="error" :style="styles.validationMessage">{{ error }}</p>
		<div v-if="result" :style="styles.fullWidthSection">
			<p>{{ result.message }}<template v-if="result.domain"> for {{ result.domain }}</template>.</p>
			<SortableTable
				v-if="forwardTable"
				:rows="forwardTable.rows"
				:columns="forwardColumns"
				:row-key="(row, index) => String(row._record ?? index)"
				empty-message="No email forwards found for this domain."
				:wrapper-style="forwardsTableWrapperStyle"
				:table-style="forwardsTableStyle"
				:header-style="forwardsHeaderStyle"
				:cell-style="forwardsCellStyle" />
			<p v-else :style="styles.hintText">No email forwards found for this domain.</p>
		</div>

		<AccountCredentialsModal v-if="credentialsModalOpen" @close="closeCredentialsModal">
			<h4 :style="styles.modalTitle">Temporary KAS credentials</h4>
			<p :style="styles.modalText">
				The server-provided KAS credentials failed. These credentials are used for one retry only and are not stored.
			</p>
			<form :style="styles.form" autocomplete="off" @submit.prevent="retryWithTemporaryCredentials">
				<label :style="styles.fieldLabel" for="hufak-forwards-kas-login">KAS login</label>
				<input id="hufak-forwards-kas-login" v-model="temporaryKasLogin" :style="styles.input" autocomplete="username">
				<label :style="styles.fieldLabel" for="hufak-forwards-kas-password">KAS password</label>
				<input id="hufak-forwards-kas-password" v-model="temporaryKasPassword" type="password" :style="styles.input" autocomplete="current-password">
				<div :style="styles.modalButtonRow">
					<button type="submit" :disabled="temporaryKasLogin.trim() === '' || temporaryKasPassword === ''" :style="styles.submitButton">Read email forwards</button>
					<button type="button" :style="styles.clearButton" @click="closeCredentialsModal">Cancel</button>
				</div>
			</form>
		</AccountCredentialsModal>
	</section>
</template>
