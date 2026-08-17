<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { apiRequest } from '../api';
import { formatTimeSince, isInactiveOverMonth } from '../utils/timeUtils';
import {
	buildSettingDiffRows,
	parseJsonObjectSetting,
	parseListSetting,
} from '../utils/settingDiff';
import { styles } from '../styles';
import AccountEmailAccountsOverview from './AccountEmailAccountsOverview.vue';
import SortableTable, { type SortableTableColumn } from './SortableTable.vue';
import SettingDiffCell from './SettingDiffCell.vue';
import SettingDiffPopover from './SettingDiffPopover.vue';
import type { DisabledUser, MailboxUser, UserStatusResponse } from '../types';

const emit = defineEmits<{ (event: 'editMailbox', uid: string): void }>();

type SettingKey = 'apporder' | 'dashboard';

interface SettingDefinition {
	key: SettingKey
	/** used in button labels and messages */
	name: string
	columnHeader: string
	entryHeader: string
	/** path segment of the per-account endpoints */
	endpoint: string
	matches: (user: MailboxUser) => boolean
	userValue: (user: MailboxUser) => string
	parse: (raw: string | undefined) => Record<string, unknown> | null
}

const SETTINGS: SettingDefinition[] = [
	{
		key: 'apporder',
		name: 'app order',
		columnHeader: 'NC app order',
		entryHeader: 'App',
		endpoint: 'apporder',
		matches: (user) => Boolean(user.apporderMatches),
		userValue: (user) => user.apporder || '',
		parse: parseJsonObjectSetting,
	},
	{
		key: 'dashboard',
		name: 'dashboard widgets',
		columnHeader: 'NC dashboard widgets',
		entryHeader: 'Widget',
		endpoint: 'dashboard-layout',
		matches: (user) => Boolean(user.dashboardLayoutMatches),
		userValue: (user) => user.dashboardLayout || '',
		parse: parseListSetting,
	},
];

const accountColumns: SortableTableColumn<MailboxUser>[] = [
	{ id: 'uid', header: 'UID', accessor: (user) => user.uid },
	{
		id: 'emailAccounts',
		header: 'NextSnapMail email accounts',
		accessor: (user) => [user.primaryEmail, ...Object.keys(user.additionalAccounts || {})].filter(Boolean).join(' '),
	},
	...SETTINGS.map((setting) => ({
		id: setting.key,
		header: setting.columnHeader,
		accessor: (user: MailboxUser) => setting.matches(user) ? 0 : 1,
	})),
	{ id: 'lastActivity', header: 'Last activity', accessor: (user) => Number(user.lastActivityTs) || 0 },
	{ id: 'failedLogins', header: 'Failed login attempts', accessor: (user) => user.failedLoginAttempts ?? -1 },
];

const disabledAccountColumns: SortableTableColumn<DisabledUser>[] = [
	{ id: 'uid', header: 'UID', accessor: (user) => user.uid },
];

interface DiffPopoverState {
	uid: string
	settingKey: SettingKey
	top: number
	left: number
	width: number
}

interface PendingAction {
	uid: string
	settingKey: SettingKey
}

const POPOVER_MAX_WIDTH = 920;
const POPOVER_MARGIN = 8;

const isSameAction = (
	action: PendingAction | null,
	uid: string,
	settingKey: SettingKey,
): boolean => action?.uid === uid && action.settingKey === settingKey;

const loading = ref(true);
const error = ref('');
const users = ref<MailboxUser[]>([]);
const disabledUsers = ref<DisabledUser[]>([]);
const defaultApporder = ref('');
const defaultDashboardLayout = ref('');
const diffPopover = ref<DiffPopoverState | null>(null);
const resetting = ref<PendingAction | null>(null);
const promoting = ref<PendingAction | null>(null);
const promoteConfirm = ref<PendingAction | null>(null);

const nextcloudUsersUrl = OC.generateUrl('/settings/users');

const defaultValueFor = (settingKey: SettingKey): string =>
	settingKey === 'apporder' ? defaultApporder.value : defaultDashboardLayout.value;

const loadUserStatus = async () => {
	try {
		const data = await apiRequest<UserStatusResponse>(
			OC.generateUrl('/apps/hufak/api/accounts/status'),
		);
		const nextUsers = Array.isArray(data.users) ? data.users : [];
		nextUsers.forEach((user) => {
			if (user?.identitiesLookupError) {
				console.warn(
					`[hufak] identities lookup failed for ${user.uid || 'unknown'}:`,
					user.identitiesLookupError,
				);
			}
			if (user?.additionalAccountIdentitiesLookupErrors) {
				Object.entries(user.additionalAccountIdentitiesLookupErrors).forEach(
					([account, message]) => {
						console.warn(
							`[hufak] additional account identities lookup failed for ${user.uid || 'unknown'} (${account}):`,
							message,
						);
					},
				);
			}
		});
		users.value = nextUsers;
		disabledUsers.value = Array.isArray(data.disabledUsers) ? data.disabledUsers : [];
		defaultApporder.value = typeof data.defaultApporder === 'string' ? data.defaultApporder : '';
		defaultDashboardLayout.value =
			typeof data.defaultDashboardLayout === 'string' ? data.defaultDashboardLayout : '';
		error.value = '';
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Failed to load status';
	} finally {
		loading.value = false;
	}
};

// the panel is positioned against the viewport, so any scroll or resize would
// leave it detached from its trigger button
const closeDiffPopover = () => {
	diffPopover.value = null;
};

watch(diffPopover, (popover) => {
	if (popover) {
		window.addEventListener('scroll', closeDiffPopover, true);
		window.addEventListener('resize', closeDiffPopover);
	} else {
		window.removeEventListener('scroll', closeDiffPopover, true);
		window.removeEventListener('resize', closeDiffPopover);
	}
});

onMounted(loadUserStatus);
onBeforeUnmount(() => {
	window.removeEventListener('scroll', closeDiffPopover, true);
	window.removeEventListener('resize', closeDiffPopover);
});

const toggleDiffPopover = (uid: string, settingKey: SettingKey, anchor: HTMLElement) => {
	if (diffPopover.value?.uid === uid && diffPopover.value.settingKey === settingKey) {
		diffPopover.value = null;
		return;
	}
	const rect = anchor.getBoundingClientRect();
	const width = Math.min(POPOVER_MAX_WIDTH, window.innerWidth - 2 * POPOVER_MARGIN);
	const left = Math.max(
		POPOVER_MARGIN,
		Math.min(rect.left, window.innerWidth - width - POPOVER_MARGIN),
	);
	diffPopover.value = { uid, settingKey, top: rect.bottom + 6, left, width };
};

const applyDefaultSetting = async (uid: string, setting: SettingDefinition) => {
	diffPopover.value = null;
	resetting.value = { uid, settingKey: setting.key };
	try {
		await apiRequest(
			OC.generateUrl(
				`/apps/hufak/api/accounts/${encodeURIComponent(uid)}/${setting.endpoint}/default`,
			),
			{ method: 'POST' },
		);
		await loadUserStatus();
	} catch (err) {
		error.value = `Failed to reset ${setting.name} for ${uid}: ${err instanceof Error ? err.message : 'Unknown error'}`;
	} finally {
		resetting.value = null;
	}
};

const promoteSettingToDefault = async (uid: string, setting: SettingDefinition) => {
	diffPopover.value = null;
	promoteConfirm.value = null;
	promoting.value = { uid, settingKey: setting.key };
	try {
		await apiRequest(
			OC.generateUrl(
				`/apps/hufak/api/accounts/${encodeURIComponent(uid)}/${setting.endpoint}/promote`,
			),
			{ method: 'POST' },
		);
		await loadUserStatus();
	} catch (err) {
		error.value = `Failed to set default ${setting.name} from ${uid}: ${err instanceof Error ? err.message : 'Unknown error'}`;
	} finally {
		promoting.value = null;
	}
};

const diffSetting = computed(() =>
	diffPopover.value
		? SETTINGS.find((setting) => setting.key === diffPopover.value?.settingKey)
		: undefined,
);
const diffUser = computed(() =>
	diffPopover.value ? users.value.find((user) => user.uid === diffPopover.value?.uid) : undefined,
);
const diffUserRaw = computed(() =>
	diffSetting.value && diffUser.value ? diffSetting.value.userValue(diffUser.value) : '',
);
const diffDefaultRaw = computed(() =>
	diffPopover.value ? defaultValueFor(diffPopover.value.settingKey) : '',
);
const diffRows = computed(() => {
	const userParsed = diffSetting.value ? diffSetting.value.parse(diffUserRaw.value) : null;
	const defaultParsed = diffSetting.value ? diffSetting.value.parse(diffDefaultRaw.value) : null;
	return userParsed && defaultParsed ? buildSettingDiffRows(userParsed, defaultParsed) : null;
});
const promoteConfirmSetting = computed(() =>
	promoteConfirm.value
		? SETTINGS.find((setting) => setting.key === promoteConfirm.value?.settingKey)
		: undefined,
);
</script>

<template>
	<section v-if="loading" :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Cloud account overview</h2>
			<p>Loading account status...</p>
		</div>
	</section>
	<section v-else-if="error" :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Cloud account overview</h2>
			<p :style="styles.validationMessage">Failed to load status: {{ error }}</p>
		</div>
	</section>
	<section v-else :style="styles.fullWidthSection">
		<SettingDiffPopover
			v-if="diffPopover && diffSetting && diffUser"
			:title="`${diffSetting.name} of ${diffUser.uid} vs. default ${diffSetting.name}`"
			:entry-header="diffSetting.entryHeader"
			:user-label="`${diffUser.uid} (user)`"
			:rows="diffRows"
			:user-raw="diffUserRaw"
			:default-raw="diffDefaultRaw"
			:top="diffPopover.top"
			:left="diffPopover.left"
			:width="diffPopover.width"
			:margin="POPOVER_MARGIN"
			@close="diffPopover = null" />
		<div
			v-if="promoteConfirm && promoteConfirmSetting"
			:style="styles.modalBackdrop"
			role="presentation"
			@mousedown="promoteConfirm = null">
			<div :style="styles.modalCard" @mousedown.stop>
				<h4 :style="styles.modalTitle">Set new default {{ promoteConfirmSetting.name }}</h4>
				<p :style="styles.modalText">
					Store the {{ promoteConfirmSetting.name }} of
					<strong>{{ promoteConfirm.uid }}</strong> as the new global default
					{{ promoteConfirmSetting.name }}? It will be used for newly created accounts and
					when resetting other accounts.
				</p>
				<div :style="styles.modalButtonRow">
					<button
						type="button"
						:style="styles.submitButton"
						@click="promoteSettingToDefault(promoteConfirm.uid, promoteConfirmSetting)">
						Set as default
					</button>
					<button type="button" :style="styles.clearButton" @click="promoteConfirm = null">
						Cancel
					</button>
				</div>
			</div>
		</div>
		<div :style="styles.proseContent">
			<h2>Account overview</h2>
			<p :style="styles.introText">
				Hufak-specific Nextcloud account and NextSnapMail email settings overview and
				quick-edit. To deactive and delete old accounts, use
				<a :href="nextcloudUsersUrl" :style="styles.inlineLink">Nextcloud account management</a>.
			</p>
		</div>
		<SortableTable
			:rows="users"
			:columns="accountColumns"
			:row-key="(user) => user.uid"
			empty-message="No active accounts found."
			:wrapper-style="styles.tableWrapper"
			:table-style="styles.table"
			:header-style="styles.tableHeader"
			:cell-style="styles.tableCell">
			<template #cell="{ row: user, columnId }">
				<template v-if="columnId === 'uid'">{{ user.uid }}</template>
				<template v-else-if="columnId === 'emailAccounts'">
							<div :style="styles.emailCellLayout">
								<div :style="styles.emailCellContent">
									<AccountEmailAccountsOverview :user="user" />
								</div>
								<button
									type="button"
									:style="styles.emailCellEditButton"
									:title="`edit NextSnapMail accounts for user ${user.uid}`"
									:aria-label="`edit NextSnapMail accounts for user ${user.uid}`"
									@click="emit('editMailbox', user.uid)">
									<span class="icon icon-rename" aria-hidden="true" :style="styles.squareIcon" />
								</button>
							</div>
				</template>
				<template v-else-if="SETTINGS.some((setting) => setting.key === columnId)">
					<div :style="styles.statusWithTooltip">
						<SettingDiffCell
							:setting-name="SETTINGS.find((setting) => setting.key === columnId)?.name || ''"
							:uid="user.uid"
							:matches="SETTINGS.find((setting) => setting.key === columnId)?.matches(user) || false"
							:busy="isSameAction(resetting, user.uid, columnId as SettingKey) || isSameAction(promoting, user.uid, columnId as SettingKey)"
							:applying="isSameAction(resetting, user.uid, columnId as SettingKey)"
							:promoting="isSameAction(promoting, user.uid, columnId as SettingKey)"
							:inspect-expanded="diffPopover?.uid === user.uid && diffPopover?.settingKey === columnId"
							@inspect="toggleDiffPopover(user.uid, columnId as SettingKey, $event)"
							@apply-default="applyDefaultSetting(user.uid, SETTINGS.find((setting) => setting.key === columnId)!)"
							@promote-to-default="promoteConfirm = { uid: user.uid, settingKey: columnId as SettingKey }" />
					</div>
				</template>
				<template v-else-if="columnId === 'lastActivity'">
					<span>{{ formatTimeSince(user.lastActivityTs) }}</span>
					<span
						v-if="user.lastActivityTs !== null && user.lastActivityTs !== undefined && Number(user.lastActivityTs) > 0 && isInactiveOverMonth(user.lastActivityTs)"
						:style="styles.inactiveWarning"
						title="No activity for more than one month">!</span>
				</template>
				<template v-else-if="columnId === 'failedLogins'">
					{{ Number.isInteger(user.failedLoginAttempts) ? user.failedLoginAttempts : '-' }}
				</template>
			</template>
		</SortableTable>
		<div :style="styles.proseContent">
			<h3 :style="styles.subheading">Disabled accounts</h3>
		</div>
		<SortableTable
			:rows="disabledUsers"
			:columns="disabledAccountColumns"
			:row-key="(user) => user.uid"
			empty-message="No disabled accounts found."
			:wrapper-style="styles.tableWrapper"
			:table-style="styles.table"
			:header-style="styles.tableHeader"
			:cell-style="styles.tableCell" />
	</section>
</template>
