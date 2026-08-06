<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { apiRequest } from '../api';
import { SECTION_KEYS, updateUrlSection } from '../constants';
import AccountEmailAccountsOverview from './AccountEmailAccountsOverview.vue';
import AccountCredentialsForm from './AccountCredentialsForm.vue';
import AccountCredentialsModal from './AccountCredentialsModal.vue';
import { styles } from '../styles';
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
const addingAdditionalAccount = ref<{ uid: string; primaryEmail: string } | null>(null);
const editingEmail = ref('');
const editingPassword = ref('');
const editingSubmitting = ref(false);
const editingStatus = ref('');
const setupResultModal = ref<{ title: string; message: string } | null>(null);

const headerRowStyle = {
	...styles.buttonRow,
	marginBottom: '6px',
	alignItems: 'center',
	width: '100%',
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
const additionalAccountNote = computed(() =>
	addingAdditionalAccount.value
		? `This user already has ${addingAdditionalAccount.value.primaryEmail} set as its primary account. Beware that any additional accounts you set here will be associated with the primary email account, so any other Nextcloud user who shares the same primary account will also get access to the additional accounts.`
		: '',
);

watch([configureMailUser, hasConfiguredEmailAccounts], () => {
	if (!hasConfiguredEmailAccounts.value && configureMailUser.value) {
		editingAccountCredentials.value = { uid: configureMailUser.value.uid, email: '' };
		editingEmail.value = '';
		editingPassword.value = '';
		editingStatus.value = '';
		editingSubmitting.value = false;
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

const openAdditionalAccountEditor = (uid: string) => {
	const primaryEmail = String(configureMailUser.value?.primaryEmail || '').trim();
	if (!uid || !primaryEmail) {
		setupResultModal.value = {
			title: 'Add additional account failed',
			message: 'A primary account must be configured before adding additional accounts.',
		};
		return;
	}
	addingAdditionalAccount.value = { uid, primaryEmail };
	editingEmail.value = '';
	editingPassword.value = '';
	editingStatus.value = '';
	editingSubmitting.value = false;
};

const closeAdditionalAccountEditor = () => {
	addingAdditionalAccount.value = null;
	editingEmail.value = '';
	editingPassword.value = '';
	editingStatus.value = '';
	editingSubmitting.value = false;
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
}: { uid: string; email: string; password?: string }): Promise<string> => {
	const body = new URLSearchParams({ uid, email });
	if (password !== '') {
		body.set('password', password);
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
	if (!uid || !editingEmail.value || !editingPassword.value) {
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

const submitAdditionalAccountSettings = async () => {
	const uid = addingAdditionalAccount.value?.uid || '';
	if (!uid || !editingEmail.value || !editingPassword.value) {
		setupResultModal.value = {
			title: 'Add additional account failed',
			message: 'Please provide e-mail and password.',
		};
		return;
	}

	editingSubmitting.value = true;
	try {
		const body = new URLSearchParams({
			uid,
			email: editingEmail.value.trim(),
			password: editingPassword.value,
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
		closeAdditionalAccountEditor();
		setupResultModal.value = {
			title: 'Additional account added',
			message: response.message || 'Additional account added.',
		};
	} catch (err) {
		closeAdditionalAccountEditor();
		setupResultModal.value = {
			title: 'Add additional account failed',
			message: err instanceof Error ? err.message : 'Failed to add additional account',
		};
	} finally {
		editingSubmitting.value = false;
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
			return response.message || 'Additional account deleted.';
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
			<button
				type="button"
				:style="styles.clearButton"
				aria-label="Back to account overview"
				title="Back to account overview"
				@click="navigateBackToAccountOverview">
				<svg viewBox="0 0 24 24" aria-hidden="true" :style="styles.squareIcon">
					<path fill="currentColor" d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" />
				</svg>
			</button>
			<h2 style="margin: 0">
				<template v-if="resolvedUid">
					NextSnapMail accounts for user
					<code :style="styles.monospaceCode">{{ resolvedUid }}</code>
				</template>
				<template v-else>NextSnapMail accounts</template>
			</h2>
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
				:on-add-additional-account="openAdditionalAccountEditor"
				:shared-primary-account-user-uids="sharedPrimaryAccountUserUids">
				<template v-if="configureMailUser" #emptyEditable>
					<div :style="styles.form">
						<p :style="styles.modalText">
							This Nextcloud user has no primary NextSnapMail email account associated
							with it yet. You can set one here:
						</p>
						<AccountCredentialsForm
							title="Set account"
							:email="editingEmail"
							:password="editingPassword"
							:submitting="editingSubmitting"
							status=""
							:show-status="false"
							submit-label="Set"
							email-input-id="hufak-inline-mailbox-email"
							password-input-id="hufak-inline-mailbox-password"
							:email-suggestions="emailSuggestions"
							@update:email="editingEmail = $event"
							@update:password="editingPassword = $event"
							@submit="submitPrimaryAccountSettingsForUid(configureMailUser.uid)" />
					</div>
				</template>
			</AccountEmailAccountsOverview>
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

		<AccountCredentialsModal
			v-if="addingAdditionalAccount"
			@close="closeAdditionalAccountEditor">
			<AccountCredentialsForm
				title="Add additional account"
				:note="additionalAccountNote"
				label="Additional mailbox"
				:email="editingEmail"
				:password="editingPassword"
				:submitting="editingSubmitting"
				:status="editingStatus"
				:show-status="false"
				submit-label="Add"
				email-input-id="hufak-additional-account-email"
				password-input-id="hufak-additional-account-password"
				:email-suggestions="emailSuggestions"
				cancellable
				cancel-label="Cancel"
				@update:email="editingEmail = $event"
				@update:password="editingPassword = $event"
				@submit="submitAdditionalAccountSettings"
				@cancel="closeAdditionalAccountEditor" />
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
					<button type="button" :style="styles.clearButton" @click="setupResultModal = null">
						Close
					</button>
				</div>
			</div>
		</div>
	</section>
</template>
