<script setup lang="ts">
import { computed, onMounted, ref, type CSSProperties } from 'vue';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcTextField from '@nextcloud/vue/components/NcTextField';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { TelegramBotTokenResponse, TelegramSettingsResponse } from '../types';

const token = ref('');
const isSaving = ref(false);
const message = ref('');
const error = ref('');
const bot = ref<Record<string, string | number | boolean | null> | null>(null);
const hufakGroupChatId = ref('-1002550179549');
const angewandteGroupChatId = ref('-1002497118109');
const hufakMemberIds = ref('');
const savingGroupChatId = ref<'hufak' | 'angewandte' | null>(null);
const groupChatIdMessage = ref('');
const groupChatIdError = ref('');
const botDetails = computed(() => Object.entries(bot.value || {}).filter(([, value]) => value !== null));
const formatBotField = (field: string) => field.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const settingsLayoutStyle: CSSProperties = { display: 'grid', gap: '16px', marginTop: '16px' };
const settingsSectionStyle: CSSProperties = { display: 'grid', gap: '10px', margin: 0 };
const compactFieldRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '280px max-content', alignItems: 'end', gap: '8px', width: 'fit-content', maxWidth: '100%' };
const compactInputStyle: CSSProperties = { width: '280px', minWidth: 0 };
const compactButtonStyle: CSSProperties = { minWidth: 'max-content', whiteSpace: 'nowrap' };
const rosterFieldStyle: CSSProperties = { display: 'grid', gap: '4px', width: '280px', minWidth: 0 };
const rosterTextareaStyle: CSSProperties = { ...styles.input, width: '100%', minWidth: 0, resize: 'vertical' };

const testAndSave = async () => {
	if (token.value.trim() === '') return;
	isSaving.value = true;
	message.value = '';
	error.value = '';
	bot.value = null;
	try {
		const result = await apiRequest<TelegramBotTokenResponse>(
			OC.generateUrl('/apps/hufak/api/telegram/bot-token'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ token: token.value.trim() }),
			},
		);
		const username = typeof result.bot?.username === 'string' && result.bot.username !== '' ? ` (@${result.bot.username})` : '';
		message.value = `${result.message || 'Telegram Bot API key tested and saved'}${username}`;
		bot.value = result.bot || null;
		token.value = '';
	} catch (err) {
		error.value = err instanceof Error ? err.message : 'Telegram Bot API key test failed';
	} finally {
		isSaving.value = false;
	}
};

const loadGroupChatIds = async () => {
	try {
		const settings = await apiRequest<TelegramSettingsResponse>(OC.generateUrl('/apps/hufak/api/telegram/settings'));
		hufakGroupChatId.value = settings.hufakGroupChatId || '-1002550179549';
		angewandteGroupChatId.value = settings.angewandteGroupChatId || '-1002497118109';
		hufakMemberIds.value = settings.hufakMemberIds || '';
	} catch (err) {
		groupChatIdError.value = err instanceof Error ? err.message : 'Failed to load Telegram group chat IDs';
	}
};

const saveHufakMemberRoster = async () => {
	if (savingGroupChatId.value !== null) return;
	savingGroupChatId.value = 'hufak';
	groupChatIdMessage.value = '';
	groupChatIdError.value = '';
	try {
		const result = await apiRequest<{ message?: string, memberIds?: string }>(
			OC.generateUrl('/apps/hufak/api/telegram/settings/hufak-member-ids'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ memberIds: hufakMemberIds.value }),
			},
		);
		hufakMemberIds.value = result.memberIds || '';
		groupChatIdMessage.value = result.message || 'Hufak member roster saved';
	} catch (err) {
		groupChatIdError.value = err instanceof Error ? err.message : 'Failed to save Hufak member roster';
	} finally {
		savingGroupChatId.value = null;
	}
};

const saveGroupChatId = async (group: 'hufak' | 'angewandte') => {
	if (savingGroupChatId.value !== null) return;
	const chatId = group === 'hufak' ? hufakGroupChatId.value : angewandteGroupChatId.value;
	savingGroupChatId.value = group;
	groupChatIdMessage.value = '';
	groupChatIdError.value = '';
	try {
		const result = await apiRequest<{ message?: string, chatId?: string }>(
			OC.generateUrl(`/apps/hufak/api/telegram/settings/${group === 'hufak' ? 'hufak' : 'angewandte'}-group-chat-id`),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body: new URLSearchParams({ chatId: chatId.trim() }),
			},
		);
		if (group === 'hufak') hufakGroupChatId.value = result.chatId || chatId.trim();
		else angewandteGroupChatId.value = result.chatId || chatId.trim();
		groupChatIdMessage.value = result.message || 'Telegram group chat ID saved';
	} catch (err) {
		groupChatIdError.value = err instanceof Error ? err.message : 'Failed to save Telegram group chat ID';
	} finally {
		savingGroupChatId.value = null;
	}
};

onMounted(() => { void loadGroupChatIds(); });
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>API key &amp; group ids</h2>
			<p :style="styles.hintText">The API key is tested with Telegram first and saved in the Nextcloud app configuration only after a successful connection.</p>
		</div>
		<div :style="settingsLayoutStyle">
			<form :style="settingsSectionStyle" @submit.prevent="testAndSave">
				<div :style="compactFieldRowStyle">
					<NcTextField v-model="token" label="Telegram Bot API key" type="password" autocomplete="off" :disabled="isSaving" :style="compactInputStyle" />
					<NcButton type="submit" variant="primary" :disabled="token.trim() === ''" :loading="isSaving" :style="compactButtonStyle">Test and save</NcButton>
				</div>
				<p v-if="message" :style="styles.hintText">{{ message }}</p>
				<dl v-if="bot" :style="styles.collapsibleContent">
					<template v-for="[field, value] in botDetails" :key="field">
						<dt :style="styles.fieldLabel">{{ formatBotField(field) }}</dt>
						<dd :style="{ margin: 0 }">{{ value }}</dd>
					</template>
				</dl>
				<p v-if="error" :style="styles.validationMessage">{{ error }}</p>
			</form>
			<div :style="settingsSectionStyle">
				<div :style="compactFieldRowStyle">
					<NcTextField v-model="hufakGroupChatId" label="Hufak group chat id" type="text" inputmode="numeric" autocomplete="off" :disabled="savingGroupChatId !== null" :style="compactInputStyle" />
					<NcButton type="button" variant="primary" :loading="savingGroupChatId === 'hufak'" :disabled="savingGroupChatId !== null" :style="compactButtonStyle" @click="saveGroupChatId('hufak')">Save</NcButton>
				</div>
				<div :style="compactFieldRowStyle">
					<NcTextField v-model="angewandteGroupChatId" label="Angewandte group chat id" type="text" inputmode="numeric" autocomplete="off" :disabled="savingGroupChatId !== null" :style="compactInputStyle" />
					<NcButton type="button" variant="primary" :loading="savingGroupChatId === 'angewandte'" :disabled="savingGroupChatId !== null" :style="compactButtonStyle" @click="saveGroupChatId('angewandte')">Save</NcButton>
				</div>
				<div :style="compactFieldRowStyle">
					<div :style="rosterFieldStyle">
						<label :style="styles.fieldLabel" for="hufak-member-roster">Hufak member roster (comma-separated Telegram user IDs)</label>
						<textarea id="hufak-member-roster" v-model="hufakMemberIds" rows="5" autocomplete="off" :disabled="savingGroupChatId !== null" :style="rosterTextareaStyle" />
					</div>
					<NcButton type="button" variant="primary" :loading="savingGroupChatId === 'hufak'" :disabled="savingGroupChatId !== null" :style="compactButtonStyle" @click="saveHufakMemberRoster">Save</NcButton>
				</div>
				<p v-if="groupChatIdMessage" :style="styles.hintText">{{ groupChatIdMessage }}</p>
				<p v-if="groupChatIdError" :style="styles.validationMessage">{{ groupChatIdError }}</p>
			</div>
		</div>
	</section>
</template>
