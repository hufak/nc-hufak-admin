<script setup lang="ts">
import { computed } from 'vue';
import { styles } from '../styles';

const props = withDefaults(
	defineProps<{
		label: string
		emailId: string
		passwordId: string
		emailName: string
		passwordName: string
		email: string
		password: string
		disabled?: boolean
		emailPlaceholder?: string
		passwordPlaceholder?: string
		emailSuggestions?: string[]
		showEmailInput?: boolean
	}>(),
	{
		disabled: false,
		emailPlaceholder: 'e-mail',
		passwordPlaceholder: 'Password',
		emailSuggestions: () => [],
		showEmailInput: true,
	},
);

const emit = defineEmits<{
	(event: 'update:email', value: string): void
	(event: 'update:password', value: string): void
}>();

const emailSuggestionsId = computed(() =>
	props.emailSuggestions.length > 0 ? `${props.emailId}-suggestions` : undefined,
);
const emailInputStyle = { ...styles.input, ...styles.addUserInput, maxWidth: 'none', minWidth: 0 };
const passwordInputStyle = { ...emailInputStyle, margin: 0 };
const passwordNoteStyle = { ...styles.hintText, margin: 0 };
</script>

<template>
	<template v-if="showEmailInput">
		<label :style="styles.fieldLabel" :for="emailId">{{ label }}</label>
		<div :style="styles.mailboxRow">
		<input
			:id="emailId"
			type="email"
			:value="email"
			autocomplete="off"
			:name="emailName"
			:disabled="disabled"
			:placeholder="emailPlaceholder"
			aria-label="email"
			:list="emailSuggestionsId"
			:style="emailInputStyle"
			@input="emit('update:email', ($event.target as HTMLInputElement).value)">
		<datalist v-if="emailSuggestionsId" :id="emailSuggestionsId">
			<option v-for="suggestion in emailSuggestions" :key="suggestion" :value="suggestion" />
		</datalist>
		</div>
	</template>
	<div class="hufak-mailbox-password-row">
			<input
				:id="passwordId"
				type="password"
				:value="password"
				autocomplete="new-password"
				:name="passwordName"
				:disabled="disabled"
				:placeholder="passwordPlaceholder"
				aria-label="password"
				:style="passwordInputStyle"
				@input="emit('update:password', ($event.target as HTMLInputElement).value)">
			<p class="hufak-mailbox-password-note" :style="passwordNoteStyle">
				Mailbox password not stored in KAS; reset it or request it from the mailbox owner
				<a
					href="https://kas.all-inkl.com/email/email-account/"
					target="_blank"
					rel="noreferrer"
				:style="styles.inlineLink">in KAS</a>.
			</p>
	</div>
</template>
