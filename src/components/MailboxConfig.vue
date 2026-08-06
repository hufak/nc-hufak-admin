<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { SharedMailboxesResponse } from '../types';

defineProps<{ emailDomain: string }>();
defineEmits<{ (event: 'update:emailDomain', value: string): void }>();

interface MailboxNameRow {
	id: string
	prefix: string
	de: string
	en: string
	extraFields: Record<string, unknown>
}

let mailboxRowId = 0;

function nextMailboxRowId(): string {
	mailboxRowId += 1;
	return `mailbox-row-${mailboxRowId}`;
}

function createMailboxNameRow(): MailboxNameRow {
	return { id: nextMailboxRowId(), prefix: '', de: '', en: '', extraFields: {} };
}

function normalizeMailboxRows(
	value: Record<string, unknown>,
): { rows: MailboxNameRow[]; extraEntries: Record<string, unknown> } {
	const rows: MailboxNameRow[] = [];
	const extraEntries: Record<string, unknown> = {};

	Object.entries(value).forEach(([prefix, entry]) => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			extraEntries[prefix] = entry;
			return;
		}

		const record = entry as Record<string, unknown>;
		rows.push({
			id: nextMailboxRowId(),
			prefix,
			de: typeof record.de === 'string' ? record.de : '',
			en: typeof record.en === 'string' ? record.en : '',
			extraFields: Object.fromEntries(
				Object.entries(record).filter(([key]) => key !== 'de' && key !== 'en'),
			),
		});
	});

	return { rows, extraEntries };
}

function buildSharedMailboxPayload(
	rows: MailboxNameRow[],
	extraEntries: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...extraEntries };

	rows.forEach((row) => {
		const prefix = row.prefix.trim();
		if (prefix === '') {
			return;
		}

		result[prefix] = { ...row.extraFields, de: row.de, en: row.en };
	});

	return result;
}

const mailboxRows = ref<MailboxNameRow[]>([]);
const extraEntries = ref<Record<string, unknown>>({});
const initialMailboxRows = ref<MailboxNameRow[]>([]);
const initialExtraEntries = ref<Record<string, unknown>>({});
const loading = ref(true);
const saving = ref(false);
const status = ref('');
const saveResultModal = ref<{ title: string; message: string } | null>(null);

const currentSerialized = computed(() =>
	JSON.stringify(buildSharedMailboxPayload(mailboxRows.value, extraEntries.value)),
);
const initialSerialized = computed(() =>
	JSON.stringify(buildSharedMailboxPayload(initialMailboxRows.value, initialExtraEntries.value)),
);
const hasChanges = computed(() => currentSerialized.value !== initialSerialized.value);
const sortedMailboxRows = computed(() =>
	[...mailboxRows.value].sort((left, right) =>
		left.prefix.trim().localeCompare(right.prefix.trim(), undefined, { sensitivity: 'base' }),
	),
);

onMounted(async () => {
	loading.value = true;
	try {
		const data = await apiRequest<SharedMailboxesResponse>(
			OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
		);
		const normalized = normalizeMailboxRows(data.sharedMailboxes || {});
		mailboxRows.value = normalized.rows;
		extraEntries.value = normalized.extraEntries;
		initialMailboxRows.value = normalized.rows;
		initialExtraEntries.value = normalized.extraEntries;
		status.value = '';
	} catch (err) {
		status.value = `Failed to load shared mailboxes: ${err instanceof Error ? err.message : 'Unknown error'}`;
	} finally {
		loading.value = false;
	}
});

const removeRow = (rowId: string) => {
	mailboxRows.value = mailboxRows.value.filter((entry) => entry.id !== rowId);
};

const addRow = () => {
	mailboxRows.value = [...mailboxRows.value, createMailboxNameRow()];
};

const saveSharedMailboxes = async () => {
	saving.value = true;
	try {
		const body = new URLSearchParams({ sharedMailboxes: currentSerialized.value });
		const data = await apiRequest<SharedMailboxesResponse>(
			OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		const normalized = normalizeMailboxRows(data.sharedMailboxes || {});
		mailboxRows.value = normalized.rows;
		extraEntries.value = normalized.extraEntries;
		initialMailboxRows.value = normalized.rows;
		initialExtraEntries.value = normalized.extraEntries;
		status.value = '';
		saveResultModal.value = {
			title: 'Save result',
			message: data.message || 'Shared mailboxes saved.',
		};
	} catch (err) {
		const message = `Failed to save shared mailboxes: ${err instanceof Error ? err.message : 'Unknown error'}`;
		status.value = message;
		saveResultModal.value = { title: 'Save failed', message };
	} finally {
		saving.value = false;
	}
};

const resetRows = () => {
	const reset = normalizeMailboxRows(
		buildSharedMailboxPayload(initialMailboxRows.value, initialExtraEntries.value),
	);
	mailboxRows.value = reset.rows;
	extraEntries.value = reset.extraEntries;
	status.value = '';
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Department names</h2>
		</div>
		<form :style="styles.form" @submit.prevent="saveSharedMailboxes">
			<div :style="styles.proseContent">
				<p :style="styles.hintText">
					Edit department email prefixes and the German and English department names.
				</p>
			</div>
			<div :style="styles.treeContainer">
				<p v-if="loading">Loading shared mailboxes...</p>
				<template v-else>
					<div :style="styles.mailboxNamesGrid">
						<div :style="styles.mailboxNamesHeader">Email prefix</div>
						<div :style="styles.mailboxNamesHeader">German name</div>
						<div :style="styles.mailboxNamesHeader">English name</div>
						<div v-for="row in sortedMailboxRows" :key="row.id" :style="styles.mailboxNamesRow">
							<div :style="styles.mailboxPrefixField">
								<input
									v-model="row.prefix"
									type="text"
									placeholder="Email prefix"
									:style="styles.treeKeyInput"
									:disabled="saving">
								<button
									type="button"
									:style="styles.mailboxDeleteButton"
									:disabled="saving"
									:aria-label="`Remove ${row.prefix || 'new mailbox'}`"
									title="Remove mailbox"
									@click="removeRow(row.id)">
									x
								</button>
							</div>
							<label :style="styles.mailboxLocaleField">
								<input
									v-model="row.de"
									type="text"
									placeholder="German department name"
									:style="styles.treeValueInput"
									:disabled="saving">
							</label>
							<label :style="styles.mailboxLocaleField">
								<input
									v-model="row.en"
									type="text"
									placeholder="English department name"
									:style="styles.treeValueInput"
									:disabled="saving">
							</label>
						</div>
					</div>
					<div :style="styles.mailboxNamesAddRow">
						<button
							type="button"
							:style="styles.mailboxAddButton"
							:disabled="loading || saving"
							aria-label="Add mailbox"
							title="Add mailbox"
							@click="addRow">
							+
						</button>
					</div>
				</template>
			</div>
			<div :style="styles.buttonRow">
				<button
					type="submit"
					:style="styles.submitButton"
					:disabled="loading || saving || !hasChanges">
					{{ saving ? 'Saving...' : 'Save shared mailboxes' }}
				</button>
				<button
					type="button"
					:style="styles.clearButton"
					:disabled="loading || saving || !hasChanges"
					@click="resetRows">
					Reset
				</button>
			</div>
			<p v-if="status" :style="styles.successMessage">{{ status }}</p>
			<div
				v-if="saveResultModal"
				:style="styles.modalBackdrop"
				role="presentation"
				@mousedown="saveResultModal = null">
				<div :style="styles.modalCard" @mousedown.stop>
					<h4 :style="styles.modalTitle">{{ saveResultModal.title }}</h4>
					<textarea
						readonly
						:value="saveResultModal.message"
						autocomplete="off"
						:style="styles.outputBox" />
					<div :style="styles.modalButtonRow">
						<button type="button" :style="styles.clearButton" @click="saveResultModal = null">
							Close
						</button>
					</div>
				</div>
			</div>
		</form>
	</section>
</template>
