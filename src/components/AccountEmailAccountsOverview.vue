<script setup lang="ts">
import { computed, ref } from 'vue';
import { apiRequest } from '../api';
import { extractAdditionalAccountEmails, extractIdentityEntries } from '../utils/accountUtils';
import { serializeSignatureMarkup, splitSignatureMarkup } from '../utils/signatureUtils';
import { styles } from '../styles';
import SignatureMarkupEditor from './SignatureMarkupEditor.vue';
import SignaturePreview from './SignaturePreview.vue';
import type {
	DeleteEntryPayload,
	EditAccountPayload,
	IdentityEntry,
	MailboxUser,
	NormalizedIdentityEntry,
	SetIdentitySignaturePayload,
	SharedMailboxesResponse,
	SignatureTemplateResponse,
} from '../types';

interface IdentityEditorModalState {
	prefix: string
	index: number
	identityId: string
	entry: IdentityEntry | NormalizedIdentityEntry
	uid: string
	accountKey?: string
	accountType?: 'primary'
	key: string
	displayName: string
	signature: string
	accountEmail: string
}

interface TemplateSignatureModalState {
	prefix: string
	index: number
	entry: NormalizedIdentityEntry
	uid: string
	accountKey?: string
	accountType?: 'primary'
	key: string
	accountEmail: string
}

const props = withDefaults(
	defineProps<{
		user: MailboxUser | null
		editable?: boolean
		onDeleteEntry?: (payload: DeleteEntryPayload) => Promise<string>
		onSetIdentitySignature?: (payload: SetIdentitySignaturePayload) => void
		onEditAccount?: (payload: EditAccountPayload) => void
		sharedPrimaryAccountUserUids?: string[]
	}>(),
	{
		editable: false,
		onDeleteEntry: undefined,
		onSetIdentitySignature: undefined,
		onEditAccount: undefined,
		sharedPrimaryAccountUserUids: () => [],
	},
);

const slots = defineSlots<{ emptyEditable?: () => unknown }>();

function getIdentityLabel(entry?: IdentityEntry | NormalizedIdentityEntry): string {
	if (!entry) {
		return 'this identity';
	}
	if ('name' in entry && typeof entry.name === 'string' && entry.name.trim() !== '') {
		return entry.name;
	}
	if ('Name' in entry && typeof entry.Name === 'string' && entry.Name.trim() !== '') {
		return entry.Name;
	}
	if ('email' in entry && typeof entry.email === 'string' && entry.email.trim() !== '') {
		return entry.email;
	}
	if ('Email' in entry && typeof entry.Email === 'string' && entry.Email.trim() !== '') {
		return entry.Email;
	}
	return 'this identity';
}

function findDepartmentNames(
	sharedMailboxes: Record<string, unknown>,
	accountKey: string,
): { de: string; en: string } | null {
	const directMatch = sharedMailboxes[accountKey];
	if (directMatch && typeof directMatch === 'object' && !Array.isArray(directMatch)) {
		const de = typeof (directMatch as Record<string, unknown>).de === 'string'
			? String((directMatch as Record<string, unknown>).de).trim()
			: '';
		const en = typeof (directMatch as Record<string, unknown>).en === 'string'
			? String((directMatch as Record<string, unknown>).en).trim()
			: '';
		if (de || en) {
			return { de, en };
		}
	}

	for (const value of Object.values(sharedMailboxes)) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		const nestedMatch = findDepartmentNames(value as Record<string, unknown>, accountKey);
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return null;
}

function buildSignatureFromTemplate(
	template: string,
	user: MailboxUser,
	accountEmail: string,
	sharedMailboxes: Record<string, unknown>,
): string {
	const displayName =
		user.accountName?.trim()
		|| user.displayName?.trim()
		|| user.name?.trim()
		|| user.fullName?.trim()
		|| user.uid.trim();
	const pronouns = user.pronouns?.trim() || user.pronoun?.trim() || '';
	const accountKey = accountEmail.includes('@')
		? accountEmail.split('@', 1)[0].trim().toLowerCase()
		: '';
	const departmentNames = accountKey !== '' ? findDepartmentNames(sharedMailboxes, accountKey) : null;
	const departmentDe = departmentNames?.de || '';
	const departmentEn = departmentNames?.en || '';

	let nextTemplate = template.replace(/\$person_name/g, displayName);
	if (departmentDe === '' && departmentEn === '') {
		nextTemplate = nextTemplate.replace(/^.*\$department_de.*(?:\r?\n)?/gm, '');
		nextTemplate = nextTemplate.replace(/^.*\$department_en.*(?:\r?\n)?/gm, '');
	} else {
		nextTemplate = nextTemplate.replace(/\$department_de/g, departmentDe);
		nextTemplate = nextTemplate.replace(/\$department_en/g, departmentEn);
	}
	if (pronouns !== '') {
		nextTemplate = nextTemplate.replace(/\$pronouns/g, pronouns);
		return nextTemplate;
	}

	nextTemplate = nextTemplate.replace(/[^\s\n]*\$pronouns[^\s\n]*/g, '');
	nextTemplate = nextTemplate.replace(/\$pronouns/g, '');
	nextTemplate = nextTemplate.replace(/[ \t]{2,}/g, ' ');
	nextTemplate = nextTemplate.replace(/\n{3,}/g, '\n\n');
	return nextTemplate;
}

const identityEditorModal = ref<IdentityEditorModalState | null>(null);
const identityDisplayName = ref('');
const identitySignatureDraft = ref('');
const identityUseHtmlSignature = ref(false);
const identityTemplateLoading = ref(false);
const identitySaving = ref(false);
const templateSignatureModal = ref<TemplateSignatureModalState | null>(null);
const templateSignatureDraft = ref('');
const templateUseHtmlSignature = ref(false);
const templateSignatureLoadingKey = ref<string | null>(null);
const templateSignatureSaving = ref(false);
const signatureResultModal = ref<{ title: string; message: string; signature: string | null } | null>(null);
const deleteModal = ref<DeleteEntryPayload | null>(null);
const deleteResultModal = ref<{ title: string; message: string } | null>(null);
const deleteSubmitting = ref(false);

const additionalEmailEntries = computed(() =>
	extractAdditionalAccountEmails(props.user?.additionalAccounts),
);
const primaryIdentityEntries = computed(() => extractIdentityEntries(props.user?.identities));
const hasPrimaryEmail = computed(() => Boolean(props.user?.primaryEmail?.trim()));
const hasAnyConfiguredEmailAccounts = computed(
	() => hasPrimaryEmail.value || additionalEmailEntries.value.length > 0,
);
const showEmptyEditableState = computed(
	() => props.editable && !hasAnyConfiguredEmailAccounts.value && Boolean(slots.emptyEditable),
);
const additionalAccountSections = computed(() =>
	additionalEmailEntries.value.map(({ accountKey, email }) => ({
		accountKey,
		email,
		identities: extractIdentityEntries(props.user?.additionalAccountIdentities?.[accountKey]),
	})),
);
const displayNamePlaceholder = computed(() => {
	const user = props.user;
	return `e.g. ${user?.displayName?.trim() || user?.name?.trim() || user?.fullName?.trim() || user?.uid || ''}`;
});
const identityDisplayNameStyle = { ...styles.input, maxWidth: '100%' };
const identityFormStyle = { ...styles.form, gap: '6px', marginBottom: '12px' };
const identityCompactRowStyle = { ...styles.identityEntryRow, ...styles.identityCompactEntryRow };
const identityTreeCellStyle = { ...styles.overviewTreeCell, ...styles.identityTreeCell };
const additionalAccountCellStyle = { ...styles.overviewTreeCell, ...styles.additionalAccountTreeCell };
const identityAccountHeaderStyle = { ...styles.identityHeaderCell, ...styles.identityAccountHeader };

const accountEmailFor = (prefix: string): string =>
	prefix === 'primary'
		? String(props.user?.primaryEmail || '').trim()
		: String(props.user?.additionalAccounts?.[prefix]?.email || '').trim();

const actionKeyFor = (prefix: string, index: number): string =>
	`${props.user?.uid}-${prefix}-${index}`;

const requestDelete = (payload: DeleteEntryPayload) => {
	deleteModal.value = payload;
};

const openAccountEditor = (payload: EditAccountPayload) => {
	props.onEditAccount?.(payload);
};

const openIdentityEditor = (entry: NormalizedIdentityEntry, prefix: string, index: number) => {
	const user = props.user;
	if (!user) {
		return;
	}
	const identitySignature = typeof entry.signature === 'string' ? entry.signature : '';
	const { text, useHtml } = splitSignatureMarkup(identitySignature);
	identityDisplayName.value = entry.name;
	identitySignatureDraft.value = text;
	identityUseHtmlSignature.value = useHtml;
	identityTemplateLoading.value = false;
	identitySaving.value = false;
	identityEditorModal.value = {
		prefix,
		index,
		identityId: entry.identityId,
		entry,
		uid: user.uid,
		accountKey: prefix === 'primary' ? undefined : prefix,
		accountType: prefix === 'primary' ? 'primary' : undefined,
		key: actionKeyFor(prefix, index),
		displayName: entry.name,
		signature: identitySignature,
		accountEmail: accountEmailFor(prefix),
	};
};

const closeIdentityEditor = () => {
	identityEditorModal.value = null;
	identityDisplayName.value = '';
	identitySignatureDraft.value = '';
	identityUseHtmlSignature.value = false;
	identityTemplateLoading.value = false;
	identitySaving.value = false;
};

const closeTemplateSignatureModal = () => {
	templateSignatureModal.value = null;
	templateSignatureDraft.value = '';
	templateUseHtmlSignature.value = false;
	templateSignatureSaving.value = false;
};

const closeDeleteModal = () => {
	if (deleteSubmitting.value) {
		return;
	}
	deleteModal.value = null;
};

const confirmDelete = async () => {
	if (typeof props.onDeleteEntry !== 'function' || !deleteModal.value) {
		closeDeleteModal();
		return;
	}

	deleteSubmitting.value = true;
	try {
		const message = await props.onDeleteEntry(deleteModal.value);
		deleteResultModal.value = { title: 'Delete result', message };
	} catch (error) {
		deleteResultModal.value = {
			title: 'Delete failed',
			message: error instanceof Error ? error.message : 'Delete action failed.',
		};
	} finally {
		deleteSubmitting.value = false;
		deleteModal.value = null;
	}
};

const saveIdentityChanges = async () => {
	const modal = identityEditorModal.value;
	if (!modal) {
		return;
	}

	identitySaving.value = true;
	try {
		const storedSignature = serializeSignatureMarkup(
			identitySignatureDraft.value,
			identityUseHtmlSignature.value,
		);
		const response = await apiRequest<{ message?: string }>(
			OC.generateUrl('/apps/hufak/api/snappymail/identity-signature'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({
					uid: modal.uid,
					index: String(modal.index),
					displayName: identityDisplayName.value,
					signature: storedSignature,
					accountType: modal.accountType || '',
					accountKey: modal.accountKey || '',
				}),
			},
		);

		props.onSetIdentitySignature?.({
			uid: modal.uid,
			accountKey: modal.accountKey,
			accountType: modal.accountType,
			index: modal.index,
			entry: modal.entry,
			displayName: identityDisplayName.value,
			signature: storedSignature,
			prefix: modal.prefix,
			key: modal.key,
		});
		closeIdentityEditor();
		signatureResultModal.value = {
			title: 'Identity updated',
			message: response.message || 'Identity signature updated.',
			signature: storedSignature,
		};
	} catch (error) {
		signatureResultModal.value = {
			title: 'Identity update failed',
			message: `Failed to update identity signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
			signature: null,
		};
	} finally {
		identitySaving.value = false;
	}
};

const loadIdentitySignatureFromTemplate = async () => {
	const modal = identityEditorModal.value;
	const user = props.user;
	if (!modal || !user) {
		return;
	}
	identityTemplateLoading.value = true;
	try {
		const [signatureTemplateData, sharedMailboxesData] = await Promise.all([
			apiRequest<SignatureTemplateResponse>(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
			),
			apiRequest<SharedMailboxesResponse>(
				OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
			),
		]);
		const rawTemplate =
			typeof signatureTemplateData.template === 'string' ? signatureTemplateData.template : '';
		const { text, useHtml } = splitSignatureMarkup(rawTemplate);
		identitySignatureDraft.value = buildSignatureFromTemplate(
			text,
			user,
			modal.accountEmail,
			(sharedMailboxesData.sharedMailboxes || {}) as Record<string, unknown>,
		);
		identityUseHtmlSignature.value = useHtml;
	} finally {
		identityTemplateLoading.value = false;
	}
};

const openTemplateSignatureModal = async (
	entry: NormalizedIdentityEntry,
	prefix: string,
	index: number,
) => {
	const user = props.user;
	if (!user) {
		return;
	}
	const actionKey = actionKeyFor(prefix, index);
	templateSignatureLoadingKey.value = actionKey;
	try {
		const [signatureTemplateData, sharedMailboxesData] = await Promise.all([
			apiRequest<SignatureTemplateResponse>(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
			),
			apiRequest<SharedMailboxesResponse>(
				OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
			),
		]);
		const rawTemplate =
			typeof signatureTemplateData.template === 'string' ? signatureTemplateData.template : '';
		const { text, useHtml } = splitSignatureMarkup(rawTemplate);
		templateSignatureDraft.value = buildSignatureFromTemplate(
			text,
			user,
			accountEmailFor(prefix),
			(sharedMailboxesData.sharedMailboxes || {}) as Record<string, unknown>,
		);
		templateUseHtmlSignature.value = useHtml;
		templateSignatureModal.value = {
			prefix,
			index,
			entry,
			uid: user.uid,
			accountKey: prefix === 'primary' ? undefined : prefix,
			accountType: prefix === 'primary' ? 'primary' : undefined,
			key: actionKey,
			accountEmail: accountEmailFor(prefix),
		};
	} catch (error) {
		signatureResultModal.value = {
			title: 'Signature generation failed',
			message:
				error instanceof Error ? error.message : 'Failed to generate signature from template.',
			signature: null,
		};
	} finally {
		templateSignatureLoadingKey.value = null;
	}
};

const confirmTemplateSignature = async () => {
	const modal = templateSignatureModal.value;
	if (!modal) {
		return;
	}

	templateSignatureSaving.value = true;
	try {
		const storedSignature = serializeSignatureMarkup(
			templateSignatureDraft.value,
			templateUseHtmlSignature.value,
		);
		const response = await apiRequest<{ message?: string }>(
			OC.generateUrl('/apps/hufak/api/snappymail/identity-signature'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({
					uid: modal.uid,
					index: String(modal.index),
					displayName: modal.entry.name,
					signature: storedSignature,
					accountType: modal.accountType || '',
					accountKey: modal.accountKey || '',
				}),
			},
		);

		props.onSetIdentitySignature?.({
			uid: modal.uid,
			accountKey: modal.accountKey,
			accountType: modal.accountType,
			index: modal.index,
			entry: modal.entry,
			displayName: modal.entry.name,
			signature: storedSignature,
			prefix: modal.prefix,
			key: modal.key,
		});

		closeTemplateSignatureModal();
		signatureResultModal.value = {
			title: 'Signature updated',
			message: response.message || 'Identity signature updated.',
			signature: storedSignature,
		};
	} catch (error) {
		signatureResultModal.value = {
			title: 'Signature update failed',
			message: `Failed to update identity signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
			signature: null,
		};
	} finally {
		templateSignatureSaving.value = false;
	}
};
</script>

<template>
	<p v-if="!user" :style="styles.validationMessage">No account overview available.</p>
	<slot v-else-if="showEmptyEditableState" name="emptyEditable" />
	<template v-else>
		<ul :style="editable ? styles.accountTreeListEditable : styles.accountTreeList">
			<li v-if="editable" :style="styles.accountTreeRow">
				<div :style="styles.identityColumnsHeader">
					<span :style="identityAccountHeaderStyle">
						<strong>Primary e-mail account</strong>, <em>additional accounts</em> and identities
					</span>
					<span :style="styles.identityHeaderCell" />
				</div>
			</li>

			<li :style="styles.accountTreeRow">
				<div :style="editable ? styles.identityEntryRow : styles.identityEntryRowReadOnly">
					<span :style="styles.overviewTreeCell">
						<span>
							<strong><code :style="styles.monospaceCode">{{ user.primaryEmail || '-' }}</code></strong>
						</span>
					</span>
					<div :style="styles.identityActionsColumn">
						<div v-if="editable" :style="styles.identityActionButtonGroup">
							<button
								type="button"
								:style="styles.entryEditButton"
								title="Edit primary account"
								aria-label="Edit primary account"
								@click.prevent="openAccountEditor({ type: 'primaryEmail', uid: user.uid, email: user.primaryEmail })">
								<span class="icon icon-rename" aria-hidden="true" />
							</button>
							<button
								type="button"
								:style="styles.entryDeleteButton"
								title="Remove primary email"
								aria-label="Remove primary email"
								@click.prevent="requestDelete({ type: 'primaryEmail', uid: user.uid, email: user.primaryEmail })">
								<span class="icon icon-delete" aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			</li>

			<li
				v-for="(entry, index) in (editable ? primaryIdentityEntries : [])"
				:key="`${user.uid}-primary-${index}`"
				:style="styles.identityTreeItem">
				<div :style="identityCompactRowStyle">
					<span :style="styles.identityListMarker" aria-hidden="true">-</span>
					<span :style="identityTreeCellStyle">
						<span>
							{{ entry.name }}{{ entry.name && entry.email ? ' ' : '' }}
							<template v-if="entry.email">
								&lt;<code :style="styles.monospaceCode">{{ entry.email }}</code>&gt;
							</template>
						</span>
					</span>
					<div :style="styles.identityActionsColumn">
						<div :style="styles.identityActionButtonGroup">
							<button
								type="button"
								:disabled="templateSignatureLoadingKey === actionKeyFor('primary', index)"
								:style="templateSignatureLoadingKey === actionKeyFor('primary', index)
									? { ...styles.identitySignatureButton, ...styles.disabledActionButton }
									: styles.identitySignatureButton"
								title="set signature from template"
								aria-label="set signature from template"
								@click.prevent="openTemplateSignatureModal(entry, 'primary', index)">
								<svg viewBox="0 0 24 24" aria-hidden="true" :style="styles.squareIcon">
									<path
										fill="currentColor"
										d="M6 3H14L19 8V21H6V3M13 4.5V9H17.5L13 4.5M8 11H17V12.5H8V11M8 14H17V15.5H8V14M8 17H14V18.5H8V17Z" />
								</svg>
							</button>
							<button
								type="button"
								:style="styles.entryEditButton"
								title="Edit identity"
								aria-label="Edit identity"
								@click.prevent="openIdentityEditor(entry, 'primary', index)">
								<span class="icon icon-rename" aria-hidden="true" />
							</button>
							<button
								v-if="hasPrimaryEmail"
								type="button"
								:disabled="entry.identityId === '---'"
								:style="styles.entryDeleteButton"
								:title="entry.identityId === '---' ? 'cannot delete main identity' : `Delete identity ${entry.identityId}`"
								:aria-label="entry.identityId === '---' ? 'cannot delete main identity' : `Delete identity ${entry.identityId}`"
								@click.prevent="requestDelete({ type: 'identity', uid: user.uid, accountKey: undefined, index, entry, accountType: 'primary' })">
								<span class="icon icon-delete" aria-hidden="true" />
							</button>
						</div>
					</div>
				</div>
			</li>

			<template v-for="section in additionalAccountSections" :key="`${user.uid}-additional-${section.accountKey}`">
				<li :style="styles.additionalAccountTreeRow">
					<div :style="editable ? styles.identityEntryRow : styles.identityEntryRowReadOnly">
						<span :style="additionalAccountCellStyle">
							<span :style="styles.treeConnector" aria-hidden="true" />
							<code :style="styles.monospaceCode">{{ section.email }}</code>
						</span>
						<div :style="styles.identityActionsColumn">
							<div v-if="editable" :style="styles.identityActionButtonGroup">
								<button
									type="button"
									disabled
									:style="styles.entryEditButton"
									title="Edit account"
									aria-label="Edit account"
									@click.prevent="openAccountEditor({ type: 'additionalEmail', uid: user.uid, accountKey: section.accountKey, email: section.email })">
									<span class="icon icon-rename" aria-hidden="true" />
								</button>
								<button
									type="button"
									:style="styles.entryDeleteButton"
									:title="`remove additional account ${section.email} from primary account ${user.primaryEmail || '-'}`"
									:aria-label="`remove additional account ${section.email} from primary account ${user.primaryEmail || '-'}`"
									@click.prevent="requestDelete({ type: 'additionalEmail', uid: user.uid, accountKey: section.accountKey, email: section.email })">
									<span class="icon icon-delete" aria-hidden="true" />
								</button>
							</div>
						</div>
					</div>
				</li>
				<li
					v-for="(entry, index) in (editable ? section.identities : [])"
					:key="`${user.uid}-${section.accountKey}-${index}`"
					:style="styles.identityTreeItem">
					<div :style="identityCompactRowStyle">
						<span :style="styles.identityListMarker" aria-hidden="true">-</span>
						<span :style="identityTreeCellStyle">
							<span>
								{{ entry.name }}{{ entry.name && entry.email ? ' ' : '' }}
								<template v-if="entry.email">
									&lt;<code :style="styles.monospaceCode">{{ entry.email }}</code>&gt;
								</template>
							</span>
						</span>
						<div :style="styles.identityActionsColumn">
							<div :style="styles.identityActionButtonGroup">
								<button
									type="button"
									:disabled="templateSignatureLoadingKey === actionKeyFor(section.accountKey, index)"
									:style="templateSignatureLoadingKey === actionKeyFor(section.accountKey, index)
										? { ...styles.identitySignatureButton, ...styles.disabledActionButton }
										: styles.identitySignatureButton"
									title="set signature from template"
									aria-label="set signature from template"
									@click.prevent="openTemplateSignatureModal(entry, section.accountKey, index)">
									<svg viewBox="0 0 24 24" aria-hidden="true" :style="styles.squareIcon">
										<path
											fill="currentColor"
											d="M6 3H14L19 8V21H6V3M13 4.5V9H17.5L13 4.5M8 11H17V12.5H8V11M8 14H17V15.5H8V14M8 17H14V18.5H8V17Z" />
									</svg>
								</button>
								<button
									type="button"
									:style="styles.entryEditButton"
									title="Edit identity"
									aria-label="Edit identity"
									@click.prevent="openIdentityEditor(entry, section.accountKey, index)">
									<span class="icon icon-rename" aria-hidden="true" />
								</button>
								<button
									v-if="hasPrimaryEmail"
									type="button"
									:disabled="entry.identityId === '---'"
									:style="styles.entryDeleteButton"
									:title="entry.identityId === '---' ? 'cannot delete main identity' : `Delete identity ${entry.identityId}`"
									:aria-label="entry.identityId === '---' ? 'cannot delete main identity' : `Delete identity ${entry.identityId}`"
									@click.prevent="requestDelete({ type: 'identity', uid: user.uid, accountKey: section.accountKey, index, entry, accountType: undefined })">
									<span class="icon icon-delete" aria-hidden="true" />
								</button>
							</div>
						</div>
					</div>
				</li>
			</template>

		</ul>

		<div
			v-if="identityEditorModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="closeIdentityEditor">
			<div :style="styles.signatureModalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">
					Edit identity <code :style="styles.monospaceCode">{{ identityEditorModal.identityId }}</code>
					for account <code :style="styles.monospaceCode">{{ identityEditorModal.accountEmail || '-' }}</code>
				</h4>
				<div :style="identityFormStyle">
					<label :style="styles.fieldLabel" for="hufak-identity-display-name">
						Sender display name
					</label>
					<input
						id="hufak-identity-display-name"
						v-model="identityDisplayName"
						type="text"
						:style="identityDisplayNameStyle"
						:placeholder="displayNamePlaceholder"
						:disabled="identitySaving">
				</div>
				<SignatureMarkupEditor
					:text="identitySignatureDraft"
					:use-html="identityUseHtmlSignature"
					:disabled="identitySaving"
					placeholder="no signature"
					@update:text="identitySignatureDraft = $event"
					@update:use-html="identityUseHtmlSignature = $event">
					<template #actions>
						<button
							type="button"
							:disabled="identityTemplateLoading"
							:style="styles.clearButton"
							@click.prevent="loadIdentitySignatureFromTemplate">
							{{ identityTemplateLoading ? 'Loading template...' : 'generate signature according to Hufak template' }}
						</button>
					</template>
				</SignatureMarkupEditor>
				<div :style="styles.modalButtonRow">
					<button
						type="button"
						:style="styles.submitButton"
						:disabled="identitySaving"
						@click.prevent="saveIdentityChanges">
						{{ identitySaving ? 'Saving...' : 'Save identity' }}
					</button>
					<button type="button" :style="styles.clearButton" @click.prevent="closeIdentityEditor">
						Cancel
					</button>
				</div>
			</div>
		</div>

		<div
			v-if="templateSignatureModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="closeTemplateSignatureModal">
			<div :style="styles.signatureModalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">
					Set signature for identity
					<code :style="styles.monospaceCode">{{ templateSignatureModal.entry.identityId }}</code>
					on account
					<code :style="styles.monospaceCode">{{ templateSignatureModal.accountEmail || '-' }}</code>
				</h4>
				<SignatureMarkupEditor
					:text="templateSignatureDraft"
					:use-html="templateUseHtmlSignature"
					:disabled="templateSignatureSaving"
					placeholder="no signature"
					@update:text="templateSignatureDraft = $event"
					@update:use-html="templateUseHtmlSignature = $event" />
				<div :style="styles.modalButtonRow">
					<button
						type="button"
						:style="styles.submitButton"
						:disabled="templateSignatureSaving"
						@click.prevent="confirmTemplateSignature">
						{{ templateSignatureSaving ? 'Saving...' : 'Confirm' }}
					</button>
					<button
						type="button"
						:style="styles.clearButton"
						@click.prevent="closeTemplateSignatureModal">
						Cancel
					</button>
				</div>
			</div>
		</div>

		<div
			v-if="deleteModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="closeDeleteModal">
			<div :style="styles.modalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">Confirm deletion</h4>
				<div>
					<div v-if="deleteModal.type === 'primaryEmail'" :style="styles.form">
						<p :style="styles.modalText">
							Delete the primary account
							<code :style="styles.monospaceCode">{{ deleteModal.email || '-' }}</code>
							for Nextcloud user <code :style="styles.monospaceCode">{{ user.uid }}</code>?
						</p>
						<p
							v-if="additionalEmailEntries.length > 0 || sharedPrimaryAccountUserUids.length > 0"
							:style="styles.modalText">
							Please note that
							<template v-if="additionalEmailEntries.length > 0">
								the additional accounts
								<span
									v-for="(entry, index) in additionalEmailEntries"
									:key="`${entry.accountKey}-${entry.email}`">
									<template v-if="index > 0">, </template>
									<code :style="styles.monospaceCode">{{ entry.email }}</code>
								</span>
								will remain linked to the primary account.
							</template>
							<template v-else>
								this primary account remains linked to other users.
							</template>
							This primary account is currently used by
							{{ sharedPrimaryAccountUserUids.length }} other users{{ sharedPrimaryAccountUserUids.length > 0 ? ' (' : '.' }}
							<span v-for="(uid, index) in sharedPrimaryAccountUserUids" :key="uid">
								<template v-if="index > 0">, </template>
								<code :style="styles.monospaceCode">{{ uid }}</code>
							</span>
							{{ sharedPrimaryAccountUserUids.length > 0 ? ')' : '' }}
						</p>
					</div>
					<template v-else-if="deleteModal.type === 'additionalEmail'">
						Delete the additional account
						<code :style="styles.monospaceCode">{{ deleteModal.email || '-' }}</code>?
					</template>
					<template v-else-if="deleteModal.type === 'identity'">
						Delete identity {{ getIdentityLabel(deleteModal.entry) }}?
					</template>
					<template v-else>Delete this entry?</template>
				</div>
				<div :style="styles.modalButtonRow">
					<button
						type="button"
						:style="styles.submitButton"
						:disabled="deleteSubmitting"
						@click.prevent="confirmDelete">
						{{ deleteSubmitting ? 'Deleting...' : 'Delete' }}
					</button>
					<button
						type="button"
						:style="styles.clearButton"
						:disabled="deleteSubmitting"
						@click.prevent="closeDeleteModal">
						Cancel
					</button>
				</div>
			</div>
		</div>

		<div
			v-if="deleteResultModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="deleteResultModal = null">
			<div :style="styles.modalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">{{ deleteResultModal.title }}</h4>
				<textarea
					readonly
					:value="deleteResultModal.message"
					autocomplete="off"
					:style="styles.outputBox" />
				<div :style="styles.modalButtonRow">
					<button type="button" :style="styles.clearButton" @click.prevent="deleteResultModal = null">
						Close
					</button>
				</div>
			</div>
		</div>

		<div
			v-if="signatureResultModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="signatureResultModal = null">
			<div :style="styles.signatureModalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">{{ signatureResultModal.title }}</h4>
				<textarea
					readonly
					:value="signatureResultModal.message"
					autocomplete="off"
					:style="styles.outputBox" />
				<div v-if="signatureResultModal.signature" style="margin-top: 12px">
					<p :style="styles.modalText">Applied signature preview</p>
					<div :style="styles.signaturePreviewPane">
						<SignaturePreview :signature="signatureResultModal.signature" />
					</div>
				</div>
				<div :style="styles.modalButtonRow">
					<button type="button" :style="styles.clearButton" @click.prevent="signatureResultModal = null">
						Close
					</button>
				</div>
			</div>
		</div>
	</template>
</template>
