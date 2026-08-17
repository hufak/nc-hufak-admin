<script setup lang="ts">
import { computed, ref } from 'vue';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcTextField from '@nextcloud/vue/components/NcTextField';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { TelegramBotTokenResponse } from '../types';

const token = ref('');
const isSaving = ref(false);
const message = ref('');
const error = ref('');
const bot = ref<Record<string, string | number | boolean | null> | null>(null);
const botDetails = computed(() => Object.entries(bot.value || {}).filter(([, value]) => value !== null));
const formatBotField = (field: string) => field.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

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
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Bot API key</h2>
			<p :style="styles.hintText">The key is tested with Telegram first and saved in the Nextcloud app configuration only after a successful connection.</p>
		</div>
		<form :style="styles.form" @submit.prevent="testAndSave">
			<NcTextField v-model="token" label="Telegram Bot API key" type="password" autocomplete="off" :disabled="isSaving" />
			<div :style="styles.buttonRow">
				<NcButton type="submit" variant="primary" :disabled="token.trim() === ''" :loading="isSaving">Test and save</NcButton>
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
	</section>
</template>
