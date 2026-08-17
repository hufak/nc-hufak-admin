<script setup lang="ts">
import { computed, onMounted, ref, watch, type CSSProperties } from 'vue';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch';
import NcDialog from '@nextcloud/vue/components/NcDialog';
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon';
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard';
import NcTextField from '@nextcloud/vue/components/NcTextField';
import { showError, showSuccess } from '@nextcloud/dialogs';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { TelegramAdministratorsResponse, TelegramAdministrator, TelegramMemberPreviewResponse } from '../types';
import SortableTable, { type SortableTableColumn } from './SortableTable.vue';

const administrators = ref<TelegramAdministrator[]>([]);
const chatId = ref('');
const isLoading = ref(false);
const loadError = ref('');
const hasLoadedAdministrators = ref(false);
const updatingUserIds = ref(new Set<string>());
const labelAdministrator = ref<TelegramAdministrator | null>(null);
const newAdminLabel = ref('');
const isSavingLabel = ref(false);
const dismissAdministrator = ref<TelegramAdministrator | null>(null);
const isDismissingAdministrator = ref(false);
const labelProfile = ref<TelegramMemberPreviewResponse | null>(null);
const isLoadingLabelProfile = ref(false);
const labelProfileError = ref('');
const canManage = ref(false);
const assignableRights = ref<string[]>([]);
const addDialogOpen = ref(false);
const candidate = ref('');
const candidatePreview = ref<TelegramMemberPreviewResponse | null>(null);
const candidateError = ref('');
const isLoadingCandidate = ref(false);
const candidateIsAdministrator = computed(() => candidatePreview.value?.isAdministrator === true);
const candidateAdministrator = computed(() => candidatePreview.value?.administrator || null);
const newAdministratorLabel = ref('');
const newAdministratorIsAnonymous = ref(false);
const newAdministratorRights = ref<Record<string, boolean>>({});
const isAddingAdministrator = ref(false);
let previewTimer: ReturnType<typeof setTimeout> | undefined;

const rightNames = computed(() => [...new Set(administrators.value.flatMap((administrator) => Object.keys(administrator.rights || {})))].sort());
const addAdministratorRights = computed(() => [
	...assignableRights.value.filter((right) => right !== 'can_promote_members'),
	...assignableRights.value.filter((right) => right === 'can_promote_members'),
]);
const administratorRightGroups = computed(() => {
	const groups = [
		{ label: 'Group management', rights: ['can_manage_chat', 'can_delete_messages', 'can_manage_video_chats', 'can_restrict_members', 'can_change_info', 'can_invite_users', 'can_pin_messages', 'can_manage_topics', 'can_manage_tags'] },
		{ label: 'Stories', rights: ['can_post_stories', 'can_edit_stories', 'can_delete_stories'] },
		{ label: 'Channel features', rights: ['can_post_messages', 'can_edit_messages', 'can_manage_direct_messages'] },
		{ label: 'Administrator management', rights: ['can_promote_members'] },
	];
	const knownRights = new Set(groups.flatMap((group) => group.rights));
	const available = new Set(addAdministratorRights.value);
	const availableGroups = groups
		.map((group) => ({ ...group, rights: group.rights.filter((right) => available.has(right)) }))
		.filter((group) => group.rights.length > 0);
	const otherRights = addAdministratorRights.value.filter((right) => !knownRights.has(right));
	return otherRights.length > 0 ? [...availableGroups, { label: 'Other rights', rights: otherRights }] : availableGroups;
});
const orderedRightNames = computed(() => {
	const assignable = new Set(assignableRights.value);
	return [...rightNames.value.filter((right) => assignable.has(right)), ...rightNames.value.filter((right) => !assignable.has(right))];
});
const isSavingAdministrator = computed(() => updatingUserIds.value.size > 0);
const columns = computed<SortableTableColumn<TelegramAdministrator>[]>(() => [
	{ id: 'name', header: 'Administrator', accessor: (administrator) => administratorName(administrator) },
	{ id: 'username', header: 'Username', accessor: (administrator) => administrator.user?.username ? `@${administrator.user.username}` : '' },
	{ id: 'adminLabel', header: 'Public label', accessor: (administrator) => administrator.adminLabel || '' },
	{ id: 'isAnonymous', header: 'Post anonymously', accessor: (administrator) => administrator.isAnonymous === true },
	...(canManage.value ? [{ id: 'status', header: 'Status', accessor: (administrator: TelegramAdministrator) => administrator.status || '' }] : []),
	...(canManage.value ? orderedRightNames.value.map((right) => ({
		id: `right:${right}`,
		header: administratorRightLabel(right),
		accessor: (administrator: TelegramAdministrator) => administrator.rights?.[right] === true,
	})) : []),
]);

const tableStyle = computed(() => ({ width: '100%', borderCollapse: 'collapse' as const }));
const cellStyle = computed(() => ({ padding: '8px', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top' }));
const introRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' };
const candidateInputRowStyle: CSSProperties = { display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: '10px' };
const candidateInputStyle: CSSProperties = { flex: '1 1 0', minWidth: 0 };
const rightGroupStyle: CSSProperties = { margin: 0, padding: '10px', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-large)' };
const rightGroupLegendStyle: CSSProperties = { padding: '0 4px', color: 'var(--color-text-maxcontrast)', fontSize: '13px', fontWeight: 600 };
const statusActionStyle: CSSProperties = { display: 'inline-flex', flexWrap: 'nowrap', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' };
const checkboxCellStyle: CSSProperties = { display: 'flex', justifyContent: 'center', textAlign: 'center' };
const unsetLabelStyle: CSSProperties = { color: 'var(--color-text-maxcontrast)', fontStyle: 'italic' };
const previewPhotoStyle: CSSProperties = { width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' };
const administratorRightLabels: Record<string, string> = {
	can_manage_chat: 'Manage group',
	can_delete_messages: 'Delete group messages',
	can_manage_video_chats: 'Manage group video chats',
	can_restrict_members: 'Restrict group members',
	can_promote_members: 'Add or remove group administrators',
	can_change_info: 'Change group information',
	can_invite_users: 'Invite group members',
	can_post_stories: 'Post group stories',
	can_edit_stories: 'Edit group stories',
	can_delete_stories: 'Delete group stories',
	can_post_messages: 'Post channel messages',
	can_edit_messages: 'Edit channel messages',
	can_pin_messages: 'Pin group messages',
	can_manage_topics: 'Manage group topics',
	can_manage_direct_messages: 'Manage channel direct messages',
	can_manage_tags: 'Manage channel tags',
};

const administratorRightLabel = (right: string) => administratorRightLabels[right] || right.replace(/^can_/, '').replace(/_/g, ' ');
const isAssignableRight = (right: string) => assignableRights.value.includes(right);
const canDismissAdministrator = (administrator: TelegramAdministrator) => canManage.value && administrator.isEditable !== false && isAssignableRight('can_promote_members');
const defaultAdministratorRights = () => Object.fromEntries(addAdministratorRights.value.map((right) => [right, right !== 'can_promote_members']));

function administratorName(administrator: TelegramAdministrator): string {
	return [administrator.user?.first_name, administrator.user?.last_name].filter(Boolean).join(' ') || String(administrator.user?.id || 'Unknown');
}

const loadAdministrators = async () => {
	isLoading.value = true;
	loadError.value = '';
	try {
		const result = await apiRequest<TelegramAdministratorsResponse>(
			OC.generateUrl('/apps/hufak/api/telegram/angespannte/administrators'),
		);
		administrators.value = result.administrators || [];
		chatId.value = result.chatId || '';
		canManage.value = result.canManage === true;
		assignableRights.value = result.assignableRights || [];
		hasLoadedAdministrators.value = true;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to load Telegram administrators';
		if (hasLoadedAdministrators.value) {
			showError(message);
		} else {
			loadError.value = message;
		}
	} finally {
		isLoading.value = false;
	}
};

const administratorId = (administrator: TelegramAdministrator) => String(administrator.user?.id || '');
const isUpdating = (administrator: TelegramAdministrator) => updatingUserIds.value.has(administratorId(administrator));
const copyAdministratorId = async (administrator: TelegramAdministrator) => {
	const userId = administratorId(administrator);
	if (userId === '') return;
	try {
		await navigator.clipboard.writeText(userId);
		showSuccess(`Telegram user ID ${userId} copied`);
	} catch {
		showError('Could not copy the Telegram user ID');
	}
};
const updateAnonymity = async (administrator: TelegramAdministrator, isAnonymous: boolean) => {
	const userId = administratorId(administrator);
	if (userId === '' || administrator.isEditable === false || isSavingAdministrator.value) return;
	updatingUserIds.value = new Set([...updatingUserIds.value, userId]);
	try {
		await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/anonymity`), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body: new URLSearchParams({ isAnonymous: isAnonymous ? '1' : '0' }),
		});
		administrators.value = administrators.value.map((entry) => administratorId(entry) === userId
			? { ...entry, isAnonymous }
			: entry);
	} catch (err) {
		showError(err instanceof Error ? err.message : 'Failed to update Telegram administrator anonymity');
	} finally {
		const pending = new Set(updatingUserIds.value);
		pending.delete(userId);
		updatingUserIds.value = pending;
	}
};
const updateAdministratorRight = async (administrator: TelegramAdministrator, right: string, enabled: boolean) => {
	const userId = administratorId(administrator);
	if (userId === '' || administrator.isEditable === false || !isAssignableRight(right) || isSavingAdministrator.value) return;
	updatingUserIds.value = new Set([...updatingUserIds.value, userId]);
	const rights = { ...administrator.rights, [right]: enabled };
	try {
		await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/rights`), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body: new URLSearchParams({ rights: JSON.stringify(rights) }),
		});
		administrators.value = administrators.value.map((entry) => administratorId(entry) === userId
			? { ...entry, rights }
			: entry);
	} catch (err) {
		showError(err instanceof Error ? err.message : 'Failed to update Telegram administrator rights');
	} finally {
		const pending = new Set(updatingUserIds.value);
		pending.delete(userId);
		updatingUserIds.value = pending;
	}
};

const openLabelDialog = (administrator: TelegramAdministrator) => {
	if (administrator.isEditable === false || isSavingAdministrator.value) return;
	labelAdministrator.value = administrator;
	newAdminLabel.value = administrator.adminLabel || '';
	labelProfile.value = null;
	labelProfileError.value = '';
	void loadLabelProfile(administrator);
};
const openDismissDialog = (administrator: TelegramAdministrator) => {
	if (!canDismissAdministrator(administrator) || isSavingAdministrator.value) return;
	dismissAdministrator.value = administrator;
};
const closeDismissDialog = () => {
	if (!isDismissingAdministrator.value) dismissAdministrator.value = null;
};
const confirmDismissAdministrator = async () => {
	const administrator = dismissAdministrator.value;
	const userId = administrator ? administratorId(administrator) : '';
	if (!administrator || userId === '' || !canDismissAdministrator(administrator)) return;
	isDismissingAdministrator.value = true;
	updatingUserIds.value = new Set([...updatingUserIds.value, userId]);
	try {
		await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/dismiss`), {
			method: 'POST',
		});
		dismissAdministrator.value = null;
		showSuccess('Telegram administrator dismissed');
		await loadAdministrators();
	} catch (err) {
		showError(err instanceof Error ? err.message : 'Failed to dismiss Telegram administrator');
	} finally {
		isDismissingAdministrator.value = false;
		const pending = new Set(updatingUserIds.value);
		pending.delete(userId);
		updatingUserIds.value = pending;
	}
};

const loadLabelProfile = async (administrator: TelegramAdministrator) => {
	const userId = administratorId(administrator);
	if (userId === '') return;
	isLoadingLabelProfile.value = true;
	try {
		labelProfile.value = await apiRequest<TelegramMemberPreviewResponse>(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/members/${encodeURIComponent(userId)}`));
	} catch (err) {
		labelProfileError.value = err instanceof Error ? err.message : 'Failed to load Telegram profile';
	} finally {
		isLoadingLabelProfile.value = false;
	}
};

const openAddDialog = () => {
	addDialogOpen.value = true;
	candidate.value = '';
	candidatePreview.value = null;
	candidateError.value = '';
	newAdministratorLabel.value = '';
	newAdministratorIsAnonymous.value = false;
	newAdministratorRights.value = defaultAdministratorRights();
};
const closeAddDialog = () => {
	addDialogOpen.value = false;
	if (previewTimer) clearTimeout(previewTimer);
};
const loadCandidatePreview = async () => {
	const identifier = candidate.value.trim();
	if (identifier === '') return;
	isLoadingCandidate.value = true;
	candidatePreview.value = null;
	candidateError.value = '';
	try {
		const preview = await apiRequest<TelegramMemberPreviewResponse>(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/members/${encodeURIComponent(identifier)}`));
		candidatePreview.value = preview;
		if (preview.isAdministrator && preview.administrator) {
			newAdministratorLabel.value = preview.administrator.adminLabel || '';
			newAdministratorIsAnonymous.value = preview.administrator.isAnonymous === true;
			newAdministratorRights.value = Object.fromEntries(addAdministratorRights.value.map((right) => [right, preview.administrator?.rights?.[right] === true]));
		}
	} catch (err) {
		candidateError.value = err instanceof Error ? err.message : 'Failed to load Telegram user';
	} finally {
		isLoadingCandidate.value = false;
	}
};
watch(candidate, () => {
	if (previewTimer) clearTimeout(previewTimer);
	candidatePreview.value = null;
	candidateError.value = '';
	newAdministratorLabel.value = '';
	newAdministratorIsAnonymous.value = false;
	newAdministratorRights.value = defaultAdministratorRights();
	if (candidate.value.trim() !== '') previewTimer = setTimeout(() => { void loadCandidatePreview(); }, 350);
});
const refreshCandidatePreview = () => {
	if (previewTimer) clearTimeout(previewTimer);
	void loadCandidatePreview();
};
const addAdministrator = async () => {
	if (!candidatePreview.value?.user?.id) return;
	isAddingAdministrator.value = true;
	try {
		const userId = String(candidatePreview.value.user.id);
		const isExistingAdministrator = candidateIsAdministrator.value;
		if (isExistingAdministrator) {
			if (candidateAdministrator.value?.isEditable === false) {
				throw new Error('Telegram does not allow this bot to edit that administrator');
			}
			await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/rights`), {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ rights: JSON.stringify(newAdministratorRights.value) }),
			});
			await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/label`), {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ label: newAdministratorLabel.value.trim() }),
			});
			await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/anonymity`), {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ isAnonymous: newAdministratorIsAnonymous.value ? '1' : '0' }),
			});
		} else {
			await apiRequest(OC.generateUrl('/apps/hufak/api/telegram/angespannte/administrators'), {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({
					userId,
					label: newAdministratorLabel.value.trim(),
					isAnonymous: newAdministratorIsAnonymous.value ? '1' : '0',
					rights: JSON.stringify(newAdministratorRights.value),
				}),
			});
		}
		closeAddDialog();
		showSuccess(isExistingAdministrator ? 'Telegram administrator updated' : 'Telegram administrator added');
		await loadAdministrators();
	} catch (err) {
		showError(err instanceof Error ? err.message : 'Failed to add Telegram administrator');
	} finally {
		isAddingAdministrator.value = false;
	}
};
const closeLabelDialog = () => {
	labelAdministrator.value = null;
	newAdminLabel.value = '';
	labelProfile.value = null;
	labelProfileError.value = '';
};
const saveAdminLabel = async () => {
	const userId = labelAdministrator.value ? administratorId(labelAdministrator.value) : '';
	if (userId === '' || isSavingAdministrator.value) return;
	isSavingLabel.value = true;
	updatingUserIds.value = new Set([...updatingUserIds.value, userId]);
	try {
		await apiRequest(OC.generateUrl(`/apps/hufak/api/telegram/angespannte/administrators/${encodeURIComponent(userId)}/label`), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body: new URLSearchParams({ label: newAdminLabel.value.trim() }),
		});
		administrators.value = administrators.value.map((entry) => administratorId(entry) === userId
			? { ...entry, adminLabel: newAdminLabel.value.trim() }
			: entry);
		closeLabelDialog();
	} catch (err) {
		showError(err instanceof Error ? err.message : 'Failed to update Telegram administrator label');
	} finally {
		isSavingLabel.value = false;
		const pending = new Set(updatingUserIds.value);
		pending.delete(userId);
		updatingUserIds.value = pending;
	}
};

onMounted(() => { void loadAdministrators(); });
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Die Angespannte</h2>
			<div :style="introRowStyle">
				<p :style="styles.hintText">Telegram group administrators and their granted rights{{ chatId ? ` for ${chatId}` : '' }}.</p>
				<NcButton type="button" variant="secondary" :loading="isLoading" :disabled="isSavingAdministrator" @click="loadAdministrators">Refresh</NcButton>
			</div>
		</div>
		<p v-if="isSavingAdministrator" :style="styles.hintText" role="status">Saving Telegram administrator changes…</p>
		<p v-if="loadError" :style="styles.validationMessage">{{ loadError }}</p>
		<SortableTable
			v-if="hasLoadedAdministrators"
			:aria-busy="isSavingAdministrator"
			:rows="administrators"
			:columns="columns"
			:row-key="(administrator) => administratorId(administrator) || String(administrator.user?.username || administrator.status)"
			empty-message="No Telegram administrators found."
			:table-style="tableStyle"
			:header-style="cellStyle"
			:cell-style="cellStyle">
			<template #cell="{ row, columnId, value }">
				<NcButton v-if="columnId === 'name'" type="button" variant="tertiary-no-background" :title="`Copy Telegram user ID ${administratorId(row)}`" @click="copyAdministratorId(row)">{{ value }}</NcButton>
				<NcButton v-else-if="columnId === 'adminLabel'" type="button" variant="tertiary-no-background" :disabled="!row.isEditable || isSavingAdministrator" :loading="isUpdating(row)" :title="row.isEditable ? undefined : 'Telegram does not allow this bot to edit that administrator'" @click="openLabelDialog(row)"><span :style="value ? undefined : unsetLabelStyle">{{ value || 'Set label' }}</span></NcButton>
				<span v-else-if="columnId === 'isAnonymous'" :style="checkboxCellStyle"><NcCheckboxRadioSwitch :model-value="Boolean(value)" :disabled="!row.isEditable || isSavingAdministrator" :title="row.isEditable ? undefined : 'Telegram does not allow this bot to edit that administrator'" :aria-label="`Set ${administratorName(row)} to post anonymously`" @update:model-value="updateAnonymity(row, Boolean($event))" /></span>
				<span v-else-if="columnId === 'status'" :style="statusActionStyle">
					{{ value }}
					<NcButton v-if="canDismissAdministrator(row)" type="button" size="small" variant="secondary" :disabled="isSavingAdministrator" :loading="isUpdating(row)" title="Dismiss administrator" :aria-label="`Dismiss ${administratorName(row)} as administrator`" @click="openDismissDialog(row)"><template #icon><span class="icon icon-close" aria-hidden="true" /></template></NcButton>
				</span>
				<span v-else-if="columnId.startsWith('right:')" :style="checkboxCellStyle"><NcCheckboxRadioSwitch :model-value="Boolean(value)" :disabled="!canManage || !row.isEditable || !isAssignableRight(columnId.slice(6)) || isSavingAdministrator" :title="!row.isEditable ? 'Telegram does not allow this bot to edit that administrator' : !isAssignableRight(columnId.slice(6)) ? 'The bot cannot assign this right' : undefined" :aria-label="administratorRightLabel(columnId.slice(6))" @update:model-value="updateAdministratorRight(row, columnId.slice(6), Boolean($event))" /></span>
				<template v-else>{{ value ?? '' }}</template>
			</template>
		</SortableTable>
		<div v-if="canManage" :style="styles.buttonRow">
			<NcButton type="button" variant="secondary" :disabled="isSavingAdministrator" @click="openAddDialog"><template #icon><span aria-hidden="true">＋</span></template>Add administrator</NcButton>
		</div>
		<NcDialog v-if="labelAdministrator" :open="true" name="Set Telegram public label" @update:open="closeLabelDialog">
			<div :style="styles.fieldWithNoteRow">
				<img v-if="labelProfile?.photo" :src="labelProfile.photo" alt="" :style="previewPhotoStyle">
				<div>
					<strong>{{ labelProfile?.user ? [labelProfile.user.first_name, labelProfile.user.last_name].filter(Boolean).join(' ') : administratorName(labelAdministrator) }}</strong><br>
					{{ labelProfile?.user?.username ? `@${labelProfile.user.username}` : labelAdministrator.user?.username ? `@${labelAdministrator.user.username}` : 'No Telegram username' }}<br>
					ID {{ labelProfile?.user?.id || labelAdministrator.user?.id }}
				</div>
			</div>
			<p v-if="isLoadingLabelProfile" :style="styles.hintText">Loading Telegram profile…</p>
			<p v-else-if="labelProfileError" :style="styles.hintText">Profile photo unavailable: {{ labelProfileError }}</p>
			<NcTextField v-model="newAdminLabel" label="Public label" type="text" maxlength="16" :disabled="isSavingLabel" />
			<template #actions>
				<NcButton type="button" :disabled="isSavingLabel" @click="closeLabelDialog">Cancel</NcButton>
				<NcButton type="button" variant="primary" :loading="isSavingLabel" @click="saveAdminLabel">Save</NcButton>
			</template>
		</NcDialog>
		<NcDialog v-if="dismissAdministrator" :open="true" name="Dismiss Telegram administrator" @update:open="closeDismissDialog">
			<p>Remove <strong>{{ administratorName(dismissAdministrator) }}</strong> as a Telegram group administrator? They will remain a group member.</p>
			<template #actions>
				<NcButton type="button" :disabled="isDismissingAdministrator" @click="closeDismissDialog">Cancel</NcButton>
				<NcButton type="button" variant="error" :loading="isDismissingAdministrator" @click="confirmDismissAdministrator">Dismiss administrator</NcButton>
			</template>
		</NcDialog>
		<NcDialog v-if="addDialogOpen" :open="true" name="Add Telegram administrator" @update:open="closeAddDialog">
			<div :style="candidateInputRowStyle">
				<NcTextField v-model="candidate" :style="candidateInputStyle" label="Numeric Telegram user ID" type="text" inputmode="numeric" autocomplete="off" :disabled="isAddingAdministrator" />
				<NcButton type="button" variant="secondary" :disabled="isAddingAdministrator || candidate.trim() === ''" :loading="isLoadingCandidate" title="Refresh Telegram user data" aria-label="Refresh Telegram user data" @click="refreshCandidatePreview"><template #icon><span aria-hidden="true">↻</span></template></NcButton>
			</div>
			<p :style="styles.hintText">Telegram bots can preview group members by numeric ID. Telegram does not provide a lookup from personal @username values.</p>
			<div v-if="isLoadingCandidate" :style="styles.fieldWithNoteRow" role="status">
				<NcLoadingIcon :size="20" name="Looking up Telegram user" />
				<span :style="styles.hintText">Looking up Telegram user…</span>
			</div>
			<NcNoteCard v-if="candidateError" type="error" heading="Could not load Telegram user" :text="candidateError" :show-alert="true" />
			<div v-if="candidatePreview?.user" :style="styles.fieldWithNoteRow">
				<img v-if="candidatePreview.photo" :src="candidatePreview.photo" alt="" :style="previewPhotoStyle">
				<div><strong>{{ [candidatePreview.user.first_name, candidatePreview.user.last_name].filter(Boolean).join(' ') }}</strong><br>{{ candidatePreview.user.username ? `@${candidatePreview.user.username}` : `ID ${candidatePreview.user.id}` }}</div>
			</div>
			<NcNoteCard v-if="candidateIsAdministrator" type="info" text="This user is already a group administrator. Their current settings are shown below and can be edited here." />
			<NcTextField v-model="newAdministratorLabel" label="Public label" type="text" maxlength="16" :disabled="isAddingAdministrator || !candidatePreview?.user || candidateAdministrator?.isEditable === false" />
			<NcCheckboxRadioSwitch v-model="newAdministratorIsAnonymous" :disabled="isAddingAdministrator || !candidatePreview?.user || candidateAdministrator?.isEditable === false">Post anonymously</NcCheckboxRadioSwitch>
			<fieldset v-for="group in administratorRightGroups" :key="group.label" :style="rightGroupStyle">
				<legend :style="rightGroupLegendStyle">{{ group.label }}</legend>
				<div :style="styles.radioGroup">
					<NcCheckboxRadioSwitch v-for="right in group.rights" :key="right" v-model="newAdministratorRights[right]" :disabled="isAddingAdministrator || !candidatePreview?.user || candidateAdministrator?.isEditable === false">{{ administratorRightLabel(right) }}</NcCheckboxRadioSwitch>
				</div>
			</fieldset>
			<template #actions>
				<NcButton type="button" :disabled="isAddingAdministrator" @click="closeAddDialog">Cancel</NcButton>
				<NcButton type="button" variant="primary" :disabled="!candidatePreview?.user || candidateAdministrator?.isEditable === false" :loading="isAddingAdministrator" @click="addAdministrator">{{ candidateIsAdministrator ? 'Save administrator' : 'Add administrator' }}</NcButton>
			</template>
		</NcDialog>
	</section>
</template>
