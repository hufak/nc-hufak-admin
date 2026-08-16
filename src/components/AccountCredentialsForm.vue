<script setup lang="ts">
import { styles } from '../styles';
import NcButton from '@nextcloud/vue/components/NcButton';
import MailboxCredentialsFields from './MailboxCredentialsFields.vue';

withDefaults(
	defineProps<{
		title: string
		email: string
		password: string
		submitting: boolean
		status: string
		submitLabel: string
		emailInputId: string
		passwordInputId: string
		showStatus?: boolean
		emailSuggestions?: string[]
		note?: string
		label?: string
		cancelLabel?: string
		cancellable?: boolean
	}>(),
	{
		showStatus: true,
		emailSuggestions: () => [],
		note: undefined,
		label: 'Primary mailbox',
		cancelLabel: 'Cancel',
		cancellable: false,
	},
);

const emit = defineEmits<{
	(event: 'update:email', value: string): void
	(event: 'update:password', value: string): void
	(event: 'submit'): void
	(event: 'cancel'): void
}>();
</script>

<template>
	<h4 :style="styles.modalTitle">{{ title }}</h4>
	<p v-if="note" :style="styles.modalText">{{ note }}</p>
	<form :style="styles.form" autocomplete="off" @submit.prevent="emit('submit')">
		<MailboxCredentialsFields
			:label="label"
			:email-id="emailInputId"
			:password-id="passwordInputId"
			email-name="hufak-set-mailbox-email"
			password-name="hufak-set-mailbox-password"
			:email="email"
			:password="password"
			:disabled="submitting"
			:email-suggestions="emailSuggestions"
			@update:email="emit('update:email', $event)"
			@update:password="emit('update:password', $event)" />
		<div :style="styles.modalButtonRow">
			<NcButton
				type="submit"
				:disabled="submitting || !email || !password"
				variant="primary">
				{{ submitting ? 'Setting...' : submitLabel }}
			</NcButton>
			<NcButton
				v-if="cancellable"
				type="button"
				variant="secondary"
				@click="emit('cancel')">
				{{ cancelLabel }}
			</NcButton>
		</div>
		<textarea
			v-if="showStatus"
			readonly
			:value="status"
			name="hufak-set-mailbox-output"
			autocomplete="off"
			:style="styles.outputBox"
			placeholder="Status output will appear here." />
	</form>
</template>
