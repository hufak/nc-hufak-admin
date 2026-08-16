<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { apiRequest } from '../api';
import { SECTION_KEYS, updateUrlSection } from '../constants';
import { extractAdditionalAccountEmails } from '../utils/accountUtils';
import AccountEmailAccountsOverview from './AccountEmailAccountsOverview.vue';
import AccountCredentialsForm from './AccountCredentialsForm.vue';
import AccountCredentialsModal from './AccountCredentialsModal.vue';
import MailboxCredentialsFields from './MailboxCredentialsFields.vue';
import { styles } from '../styles';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcSelect from '@nextcloud/vue/components/NcSelect';
import { showSuccess } from '@nextcloud/dialogs';
import type {
	DeleteEntryPayload,
	EmailDomainResponse,
	EditAccountPayload,
	IdentityEntry,
	MailboxUser,
	SetIdentitySignaturePayload,
	SharedMailboxesResponse,
	SnappyMailSettingsResponse,
	UserStatusResponse,
} from '../types';

const props = withDefaults(defineProps<{ preselectedUid?: string }>(), { preselectedUid: '' });

const selectedUid = ref(props.preselectedUid || '');
const configureMailUser = ref<MailboxUser | null>(null);
const loadingUser = ref(false);
const userLookupError = ref('');
const emailSuggestions = ref<string[]>([]);
const sharedPrimaryAccountUserUids = ref<string[]>([]);
const editingAccountCredentials = ref<{ uid: string; email: string } | null>(null);
const editingEmail = ref('');
const editingPassword = ref('');
const editingSubmitting = ref(false);
const editingStatus = ref('');
const setupResultModal = ref<{ title: string; message: string } | null>(null);
const kasMailboxes = ref<string[]>([]);
const mailboxPasswordAvailability = ref<Record<string, boolean>>({});
const selectedAdditionalMailbox = ref<string | null>(null);
const loadingKasMailboxes = ref(false);
const hasAttemptedKasMailboxLoad = ref(false);
const kasMailboxesError = ref('');
const addingAdditionalMailbox = ref(false);
const primaryMailboxPasswordAvailable = ref<boolean | null>(null);
const primaryMailboxPasswordError = ref('');

const headerRowStyle = {
	...styles.buttonRow,
	marginBottom: '6px',
	alignItems: 'center',
	width: '100%',
	maxWidth: 'var(--hufak-prose)',
};
const additionalMailboxSelectStyle = { width: 'min(100%, 52ch)' };
const backToOverviewRowStyle = {
	...styles.buttonRow,
	marginTop: '8px',
	width: '100%',
	maxWidth: 'var(--hufak-prose)',
	justifyContent: 'flex-end',
};

const navigateBackToAccountOverview = () => {
	updateUrlSection(SECTION_KEYS.ACCOUNT_OVERVIEW);
	window.dispatchEvent(new PopStateEvent('popstate'));
};

const loadMailboxOverview = async (uidToLoad: string) => {
	if (!uidToLoad) {
		configureMailUser.value = null;
		sharedPrimaryAccountUserUids.value = [];
		userLookupError.value = '';
		loadingUser.value = false;
		return;
	}

	loadingUser.value = true;
	userLookupError.value = '';
	try {
		const [selectedData, allUsersData] = await Promise.all([
			apiRequest<UserStatusResponse>(
				`${OC.generateUrl('/apps/hufak/api/accounts/status')}?uid=${encodeURIComponent(uidToLoad)}&includePronoun=1`,
			),
			apiRequest<UserStatusResponse>(OC.generateUrl('/apps/hufak/api/accounts/status')),
		]);
		const nextUsers = Array.isArray(selectedData.users) ? selectedData.users : [];
		const matchingUser = nextUsers.find((user) => String(user.uid || '') === String(uidToLoad));
		configureMailUser.value = matchingUser || null;
		if (!matchingUser) {
			sharedPrimaryAccountUserUids.value = [];
			userLookupError.value = `No mailbox overview found for account "${uidToLoad}".`;
		} else {
			const allUsers = Array.isArray(allUsersData.users) ? allUsersData.users : [];
			sharedPrimaryAccountUserUids.value = allUsers
				.filter(
					(user) =>
						String(user.uid || '') !== String(uidToLoad)
						&& String(user.primaryEmail || '').trim() !== ''
						&& String(user.primaryEmail || '').trim() === String(matchingUser.primaryEmail || '').trim(),
				)
				.map((user) => String(user.uid || '').trim())
				.filter((uid) => uid !== '');
		}
	} catch (err) {
		userLookupError.value = err instanceof Error ? err.message : 'Failed to load mailbox overview';
		configureMailUser.value = null;
		sharedPrimaryAccountUserUids.value = [];
	} finally {
		loadingUser.value = false;
	}
};

watch(
	() => props.preselectedUid,
	(uid) => {
		selectedUid.value = uid || '';
	},
);

watch(selectedUid, (uid) => loadMailboxOverview(uid), { immediate: true });

onMounted(async () => {
	try {
		const [domainData, sharedMailboxesData] = await Promise.all([
			apiRequest<EmailDomainResponse>(OC.generateUrl('/apps/hufak/api/settings/email-domain')),
			apiRequest<SharedMailboxesResponse>(
				OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
			),
		]);
		const emailDomain = String(domainData.emailDomain || '').trim();
		const sharedMailboxes = sharedMailboxesData.sharedMailboxes;
		if (!emailDomain || !sharedMailboxes || typeof sharedMailboxes !== 'object') {
			emailSuggestions.value = [];
			return;
		}
		const nextSuggestions = Object.keys(sharedMailboxes)
			.map((prefix) => String(prefix || '').trim())
			.filter((prefix) => prefix !== '')
			.sort((left, right) => left.localeCompare(right))
			.map((prefix) => `${prefix}@${emailDomain}`);
		emailSuggestions.value = Array.from(new Set(nextSuggestions));
	} catch {
		emailSuggestions.value = [];
	}
});

const resolvedUid = computed(() => configureMailUser.value?.uid || '');
const hasConfiguredEmailAccounts = computed(() =>
	Boolean(
		configureMailUser.value?.primaryEmail?.trim()
		|| (Array.isArray(configureMailUser.value?.additionalAccounts)
			? configureMailUser.value?.additionalAccounts.length
			: Object.keys(configureMailUser.value?.additionalAccounts || {}).length),
	),
);
const existingAdditionalMailboxEmails = computed(() => {
	const user = configureMailUser.value;
	return new Set([
		String(user?.primaryEmail || '').trim().toLowerCase(),
		...extractAdditionalAccountEmails(user?.additionalAccounts)
			.map(({ email }) => email.toLowerCase()),
	].filter((email) => email !== ''));
});
const availableAdditionalMailboxes = computed(() =>
	kasMailboxes.value.filter((email) => !existingAdditionalMailboxEmails.value.has(email.toLowerCase())),
);

watch([configureMailUser, hasConfiguredEmailAccounts], () => {
	if (!hasConfiguredEmailAccounts.value && configureMailUser.value) {
		editingAccountCredentials.value = { uid: configureMailUser.value.uid, email: '' };
		editingEmail.value = '';
		editingPassword.value = '';
		editingStatus.value = '';
		editingSubmitting.value = false;
		primaryMailboxPasswordAvailable.value = null;
		primaryMailboxPasswordError.value = '';
	}
});

const openAccountCredentialsEditor = (payload: EditAccountPayload) => {
	if (!payload || payload.type !== 'primaryEmail' || !hasConfiguredEmailAccounts.value) {
		return;
	}

	const currentPrimaryEmail = String(configureMailUser.value?.primaryEmail || '').trim();
	const initialEmail = currentPrimaryEmail || String(payload.email || '').trim();

	editingAccountCredentials.value = { uid: payload.uid, email: initialEmail };
	editingEmail.value = initialEmail;
	editingPassword.value = '';
	editingStatus.value = '';
};

const closeAccountCredentialsEditor = () => {
	editingAccountCredentials.value = null;
	editingEmail.value = '';
	editingPassword.value = '';
	editingStatus.value = '';
	editingSubmitting.value = false;
};

const onPrimaryMailboxSelect = (email: string | null) => {
	editingEmail.value = email || '';
	editingPassword.value = '';
	primaryMailboxPasswordError.value = '';
	primaryMailboxPasswordAvailable.value = email === null
		? null
		: mailboxPasswordAvailability.value[email] ?? false;
};

const loadKasMailboxes = async () => {
	if (loadingKasMailboxes.value || hasAttemptedKasMailboxLoad.value) {
		return;
	}
	hasAttemptedKasMailboxLoad.value = true;
	loadingKasMailboxes.value = true;
	kasMailboxesError.value = '';
	try {
		const data = await apiRequest<{ mailboxes?: string[]; passwordAvailability?: Record<string, boolean> }>(
			OC.generateUrl('/apps/hufak/api/kas/mailbox-addresses'),
		);
		kasMailboxes.value = Array.isArray(data.mailboxes) ? data.mailboxes : [];
		mailboxPasswordAvailability.value = data.passwordAvailability || {};
	} catch (err) {
		kasMailboxesError.value = err instanceof Error ? err.message : 'Failed to load KAS mailboxes';
	} finally {
		loadingKasMailboxes.value = false;
	}
};

const formatSnappyMailSettingsStatus = (data: SnappyMailSettingsResponse): string => {
	const output = String(data.output || '').trim();
	const errorOutput = String(data.errorOutput || '').trim();
	const identitiesFileMessage = String(data.identitiesFileMessage || '').trim();
	const exitCode = data.exitCode ?? '';
	const lines = [`Exit code: ${exitCode}`];
	if (output) {
		lines.push(`Output: ${output}`);
	}
	if (errorOutput) {
		lines.push(`Error output: ${errorOutput}`);
	}
	if (!output && !errorOutput) {
		lines.push('Command completed with no output.');
	}
	if (identitiesFileMessage) {
		lines.push(`Identity file: ${identitiesFileMessage}`);
	}
	return lines.join('\n');
};

const applyPrimaryMailboxSettings = async ({
	uid,
	email,
	password = '',
	useKasPassword = false,
}: { uid: string; email: string; password?: string; useKasPassword?: boolean }): Promise<string> => {
	const body = new URLSearchParams({ uid, email });
	if (password !== '') {
		body.set('password', password);
	}
	if (useKasPassword) {
		body.set('useKasPassword', '1');
	}
	const data = await apiRequest<SnappyMailSettingsResponse>(
		OC.generateUrl('/apps/hufak/api/snappymail/settings'),
		{
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body,
		},
	);
	await loadMailboxOverview(uid || selectedUid.value);
	return formatSnappyMailSettingsStatus(data);
};

const submitPrimaryAccountSettingsForUid = async (uid: string) => {
	const isInlineInitialSetup = !hasConfiguredEmailAccounts.value;
	const useKasPassword = isInlineInitialSetup && primaryMailboxPasswordAvailable.value === true;
	if (!uid || !editingEmail.value || (!useKasPassword && !editingPassword.value)) {
		if (isInlineInitialSetup) {
			setupResultModal.value = {
				title: 'Set primary e-mail account failed',
				message: 'Please provide e-mail and password.',
			};
		} else {
			editingStatus.value = 'Please provide e-mail and password.';
		}
		return;
	}

	editingSubmitting.value = true;
	try {
		const statusMessage = await applyPrimaryMailboxSettings({
			uid,
			email: editingEmail.value,
			password: editingPassword.value,
			useKasPassword,
		});
		if (isInlineInitialSetup) {
			editingAccountCredentials.value = null;
			editingStatus.value = '';
			setupResultModal.value = { title: 'Primary e-mail account set', message: statusMessage };
		} else {
			closeAccountCredentialsEditor();
			setupResultModal.value = {
				title: 'Primary e-mail account updated',
				message: statusMessage,
			};
		}
	} catch (err) {
		const message = `Failed to set primary e-mail account: ${err instanceof Error ? err.message : 'Unknown error'}`;
		if (isInlineInitialSetup) {
			setupResultModal.value = { title: 'Set primary e-mail account failed', message };
		} else {
			closeAccountCredentialsEditor();
			setupResultModal.value = { title: 'Update primary e-mail account failed', message };
		}
	} finally {
		editingSubmitting.value = false;
	}
};

const addSelectedAdditionalMailbox = async (email: string | null) => {
	const uid = resolvedUid.value;
	if (!uid || !email) {
		return;
	}

	addingAdditionalMailbox.value = true;
	try {
		const body = new URLSearchParams({
			uid,
			email,
			useKasPassword: '1',
		});
		const response = await apiRequest<{ message?: string }>(
			OC.generateUrl('/apps/hufak/api/snappymail/additional-account'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		await loadMailboxOverview(uid);
		showSuccess(response.message || 'Additional account added.');
	} catch (err) {
		setupResultModal.value = {
			title: 'Add additional account failed',
			message: err instanceof Error ? err.message : 'Failed to add additional account',
		};
	} finally {
		selectedAdditionalMailbox.value = null;
		addingAdditionalMailbox.value = false;
	}
};

const updateIdentitySignature = (identityPayload: SetIdentitySignaturePayload) => {
	const current = configureMailUser.value;
	if (!identityPayload || !current) {
		return;
	}

	const next = { ...current };

	const updateIdentityCollection = (
		collection: IdentityEntry[] | Record<string, IdentityEntry> | null | undefined,
	): IdentityEntry[] | Record<string, IdentityEntry> | null | undefined => {
		if (!Array.isArray(collection) && typeof collection !== 'object') {
			return collection;
		}

		const index = identityPayload.index;
		if (!Number.isInteger(index) || index < 0) {
			return collection;
		}

		if (Array.isArray(collection)) {
			if (index >= collection.length) {
				return collection;
			}
			const clone = [...collection];
			const item = clone[index];
			if (item && typeof item === 'object') {
				clone[index] = {
					...item,
					Name: identityPayload.displayName,
					signature: identityPayload.signature,
				} as IdentityEntry;
			}
			return clone;
		}

		const keys = Object.keys(collection as Record<string, IdentityEntry>);
		if (index >= keys.length) {
			return collection;
		}
		const key = keys[index];
		const item = (collection as Record<string, IdentityEntry>)[key];
		if (!item || typeof item !== 'object') {
			return collection;
		}
		return {
			...collection,
			[key]: {
				...item,
				Name: identityPayload.displayName,
				signature: identityPayload.signature,
			} as IdentityEntry,
		};
	};

	if (identityPayload.accountType === 'primary') {
		next.identities = updateIdentityCollection(current.identities);
	} else if (identityPayload.accountKey) {
		const currentAdditionalIdentities = { ...(current.additionalAccountIdentities || {}) };
		const updatedCollection = updateIdentityCollection(
			currentAdditionalIdentities[identityPayload.accountKey],
		);
		if (updatedCollection) {
			currentAdditionalIdentities[identityPayload.accountKey] = updatedCollection;
		}
		next.additionalAccountIdentities = currentAdditionalIdentities;
	}

	configureMailUser.value = next;
};

const deleteMailboxEntry = async (payload: DeleteEntryPayload): Promise<string> => {
	if (!payload) {
		return 'No delete target provided.';
	}

	if (payload.type === 'primaryEmail') {
		try {
			const body = new URLSearchParams({ uid: payload.uid || selectedUid.value });
			const response = await apiRequest<{ message?: string }>(
				OC.generateUrl('/apps/hufak/api/snappymail/settings'),
				{
					method: 'DELETE',
					headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
					body,
				},
			);
			await loadMailboxOverview(payload.uid || selectedUid.value);
			return response.message || 'Primary e-mail account removed.';
		} catch (err) {
			throw new Error(
				err instanceof Error ? err.message : 'Failed to delete primary e-mail account',
			);
		}
	}

	if (payload.type === 'additionalEmail') {
		try {
			const body = new URLSearchParams({
				uid: payload.uid || selectedUid.value,
				email: payload.email || '',
			});
			const response = await apiRequest<{ message?: string }>(
				OC.generateUrl('/apps/hufak/api/snappymail/additional-account'),
				{
					method: 'DELETE',
					headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
					body,
				},
			);
			await loadMailboxOverview(payload.uid || selectedUid.value);
			const message = response.message || 'Additional account deleted.';
			showSuccess(message);
			return message;
		} catch (err) {
			throw new Error(
				err instanceof Error ? err.message : 'Failed to delete additional e-mail account',
			);
		}
	}

	if (payload.type === 'identity') {
		return 'Deleting identities is not implemented yet.';
	}

	return 'No delete action was performed.';
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="headerRowStyle">
			<h2 style="margin: 0">
				<template v-if="resolvedUid">
					NextSnapMail accounts for user
					<code :style="styles.monospaceCode">{{ resolvedUid }}</code>
				</template>
				<template v-else>NextSnapMail accounts</template>
			</h2>
		</div>
		<div :style="backToOverviewRowStyle">
			<NcButton type="button" variant="secondary" @click="navigateBackToAccountOverview">
				<template #icon>
					<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
						<path fill="currentColor" d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" />
					</svg>
				</template>
				Back to account overview
			</NcButton>
		</div>
		<div :style="styles.form">
			<div :style="styles.proseContent">
				<p :style="styles.introText">
					In NextSnapMail, every Nextcloud user has exactly one primary e-mail account
					associated with it. Additional e-mail accounts are not tied to the Nextcloud
					user, but to the primary e-mail account! This means that when you add an
					additional personal e-mail account to a shared account (such as bipol), all
					users with bipol as their primary account will be able to access the additional
					personal account. When a user is given a personal e-mail account, it is
					therefore important to set their personal account as their primary account, and
					add shared mailboxes as additional accounts underneath.
				</p>
			</div>
			<p v-if="loadingUser">Loading account overview...</p>
			<p v-else-if="userLookupError" :style="styles.validationMessage">{{ userLookupError }}</p>
			<AccountEmailAccountsOverview
				v-else
				:user="configureMailUser"
				editable
				:on-delete-entry="deleteMailboxEntry"
				:on-set-identity-signature="updateIdentitySignature"
				:on-edit-account="openAccountCredentialsEditor"
				:shared-primary-account-user-uids="sharedPrimaryAccountUserUids">
				<template v-if="configureMailUser" #emptyEditable>
					<div :style="styles.form">
						<p :style="styles.modalText">
							This Nextcloud user has no primary NextSnapMail email account associated
							with it yet. You can set one here:
						</p>
						<form :style="styles.form" autocomplete="off" @submit.prevent="submitPrimaryAccountSettingsForUid(configureMailUser.uid)">
							<NcSelect
								:model-value="editingEmail || null"
								:options="kasMailboxes"
								:searchable="true"
								:loading="loadingKasMailboxes"
								:disabled="editingSubmitting"
								input-label="Primary mailbox"
								placeholder="Choose a mailbox"
								:style="additionalMailboxSelectStyle"
								@open="loadKasMailboxes"
								@update:model-value="onPrimaryMailboxSelect" />
							<p v-if="primaryMailboxPasswordError" :style="styles.validationMessage">{{ primaryMailboxPasswordError }}</p>
							<MailboxCredentialsFields
								v-if="primaryMailboxPasswordAvailable === false"
								label="Primary mailbox"
								email-id="hufak-inline-mailbox-email"
								password-id="hufak-inline-mailbox-password"
								email-name="hufak-inline-mailbox-email"
								password-name="hufak-inline-mailbox-password"
								:email="editingEmail"
								:password="editingPassword"
								:disabled="editingSubmitting"
								:show-email-input="false"
								@update:password="editingPassword = $event" />
							<NcButton
								type="submit"
								variant="primary"
								:disabled="editingSubmitting || !editingEmail || primaryMailboxPasswordAvailable === null || (primaryMailboxPasswordAvailable === false && !editingPassword)">
								{{ editingSubmitting ? 'Setting...' : 'Set account' }}
							</NcButton>
						</form>
					</div>
				</template>
			</AccountEmailAccountsOverview>
			<div
				v-if="configureMailUser?.primaryEmail"
				:style="styles.proseContent">
				<NcSelect
					v-model="selectedAdditionalMailbox"
					:options="availableAdditionalMailboxes"
					:searchable="true"
					:loading="loadingKasMailboxes || addingAdditionalMailbox"
					:disabled="addingAdditionalMailbox"
					input-label="Add NextSnapMail access to another mailbox"
					placeholder="Choose an additional mailbox"
					:style="additionalMailboxSelectStyle"
					@open="loadKasMailboxes"
					@update:model-value="addSelectedAdditionalMailbox" />
				<p v-if="loadingKasMailboxes" :style="styles.hintText">Loading KAS mailboxes…</p>
				<p v-if="kasMailboxesError" :style="styles.validationMessage">{{ kasMailboxesError }}</p>
			</div>
		</div>

		<AccountCredentialsModal
			v-if="editingAccountCredentials && hasConfiguredEmailAccounts"
			@close="closeAccountCredentialsEditor">
			<AccountCredentialsForm
				title="Edit primary account"
				:email="editingEmail"
				:password="editingPassword"
				:submitting="editingSubmitting"
				:status="editingStatus"
				:show-status="false"
				submit-label="Save"
				email-input-id="hufak-mailbox-email"
				password-input-id="hufak-mailbox-password"
				:email-suggestions="emailSuggestions"
				cancellable
				@update:email="editingEmail = $event"
				@update:password="editingPassword = $event"
				@submit="submitPrimaryAccountSettingsForUid(editingAccountCredentials?.uid || '')"
				@cancel="closeAccountCredentialsEditor" />
		</AccountCredentialsModal>

		<div
			v-if="setupResultModal"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="setupResultModal = null">
			<div :style="styles.modalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">{{ setupResultModal.title }}</h4>
				<textarea
					readonly
					:value="setupResultModal.message"
					autocomplete="off"
					:style="styles.outputBox" />
				<div :style="styles.modalButtonRow">
					<NcButton type="button" variant="secondary" @click="setupResultModal = null">Close</NcButton>
				</div>
			</div>
		</div>
	</section>
</template>
