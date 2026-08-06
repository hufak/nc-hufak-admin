<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiRequest } from '../api';
import { buildEmailFromUsername, fullNameIsValid, usernameFromFullName } from '../utils/userUtils';
import { styles } from '../styles';
import MailboxCredentialsFields from './MailboxCredentialsFields.vue';
import type {
	ApporderResetResponse,
	FreescoutUserResponse,
	SnappyMailSettingsResponse,
	UserCreateResponse,
} from '../types';

const props = defineProps<{ emailDomain: string }>();

const fullNamePlaceholder = 'John Doe';
const usernamePlaceholder = usernameFromFullName(fullNamePlaceholder);
const emailPlaceholder = computed(() =>
	buildEmailFromUsername(usernamePlaceholder, props.emailDomain),
);

const fullName = ref('');
const pronouns = ref('');
const username = ref('');
const email = ref('');
const defaultEmailAccount = ref('');
const defaultEmailAccountPassword = ref('');
const sendWelcomeEmail = ref(true);
const createFreescoutUser = ref(false);
const isCreating = ref(false);
const isCreateLocked = ref(false);
const creationOutput = ref('');

const isFullNameValid = computed(() => fullNameIsValid(fullName.value));
const inputStyle = { ...styles.input, ...styles.addUserInput };

watch([username, () => props.emailDomain], () => {
	email.value = username.value.trim() === ''
		? ''
		: buildEmailFromUsername(username.value, props.emailDomain);
});

const onFullNameInput = (event: Event) => {
	const nextFullName = (event.target as HTMLInputElement).value;
	fullName.value = nextFullName;
	isCreateLocked.value = false;
	username.value = usernameFromFullName(nextFullName);
};

const touch = () => {
	isCreateLocked.value = false;
};

const setPronounsQuickFill = (nextPronouns: string) => {
	pronouns.value = nextPronouns;
	isCreateLocked.value = false;
};

const onClearForm = () => {
	fullName.value = '';
	pronouns.value = '';
	username.value = '';
	email.value = '';
	defaultEmailAccount.value = '';
	defaultEmailAccountPassword.value = '';
	sendWelcomeEmail.value = true;
	createFreescoutUser.value = false;
	creationOutput.value = '';
	isCreateLocked.value = false;
};

const onSubmit = async () => {
	if (!isFullNameValid.value) {
		creationOutput.value =
			'❌ Validation failed: full name must contain at least two capitalized words.';
		return;
	}

	const shouldConfigureDefaultMailbox =
		defaultEmailAccount.value.trim() !== '' && defaultEmailAccountPassword.value !== '';
	const totalSteps =
		3 + (shouldConfigureDefaultMailbox ? 1 : 0) + (createFreescoutUser.value ? 1 : 0);
	const dashboardStep = 3;
	const mailboxStep = 4;
	const freescoutStep = shouldConfigureDefaultMailbox ? 5 : 4;
	const createdUid = String(username.value || '').trim();
	let allStepsSucceeded = true;

	isCreating.value = true;
	isCreateLocked.value = false;
	creationOutput.value = `⏳ Step 1/${totalSteps}: Creating account...`;

	try {
		const body = new URLSearchParams({
			fullName: fullName.value,
			pronoun: pronouns.value,
			username: username.value,
			email: email.value,
			sendWelcomeEmail: sendWelcomeEmail.value ? '1' : '0',
		});
		const data = await apiRequest<UserCreateResponse>(
			OC.generateUrl('/apps/hufak/api/accounts'),
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
				body,
			},
		);
		const actualCreatedUid = String(data.username || createdUid);
		const lines = [
			`✅ Step 1/${totalSteps}: ${data.message || `Account "${actualCreatedUid}" created successfully`}`,
		];
		if (data.welcomeEmailSent) {
			lines.push(`📧 Welcome email with password setup link sent to ${email.value}`);
		} else if (data.welcomeEmailError) {
			lines.push(`⚠️ Welcome email to ${email.value} could not be sent: ${data.welcomeEmailError}`);
		}
		if (data.password) {
			lines.push(`🔐 Generated password: ${data.password}`);
		}

		lines.push(`⏳ Step 2/${totalSteps}: Setting app order defaults...`);
		try {
			const resetData = await apiRequest<ApporderResetResponse>(
				OC.generateUrl(
					`/apps/hufak/api/accounts/${encodeURIComponent(actualCreatedUid)}/apporder/default`,
				),
				{ method: 'POST' },
			);
			lines.push(`✅ Step 2/${totalSteps}: ${resetData.message || 'App order defaults set'}`);
		} catch (step2Err) {
			allStepsSucceeded = false;
			lines.push(
				`❌ Step 2/${totalSteps}: Failed to set app order defaults: ${
					step2Err instanceof Error ? step2Err.message : 'Unknown error'
				}`,
			);
		}

		lines.push(`⏳ Step ${dashboardStep}/${totalSteps}: Setting dashboard widget defaults...`);
		try {
			const dashboardData = await apiRequest<ApporderResetResponse>(
				OC.generateUrl(
					`/apps/hufak/api/accounts/${encodeURIComponent(actualCreatedUid)}/dashboard-layout/default`,
				),
				{ method: 'POST' },
			);
			lines.push(
				`✅ Step ${dashboardStep}/${totalSteps}: ${dashboardData.message || 'Dashboard widget defaults set'}`,
			);
		} catch (dashboardErr) {
			allStepsSucceeded = false;
			lines.push(
				`❌ Step ${dashboardStep}/${totalSteps}: Failed to set dashboard widget defaults: ${
					dashboardErr instanceof Error ? dashboardErr.message : 'Unknown error'
				}`,
			);
		}

		if (shouldConfigureDefaultMailbox) {
			lines.push(`⏳ Step ${mailboxStep}/${totalSteps}: Setting primary account mailbox...`);
			try {
				const mailboxBody = new URLSearchParams({
					uid: actualCreatedUid,
					email: defaultEmailAccount.value.trim(),
					password: defaultEmailAccountPassword.value,
				});
				const mailboxData = await apiRequest<SnappyMailSettingsResponse>(
					OC.generateUrl('/apps/hufak/api/snappymail/settings'),
					{
						method: 'POST',
						headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
						body: mailboxBody,
					},
				);
				const exitCode = mailboxData.exitCode ?? '';
				const output = String(mailboxData.output || '').trim();
				const errorOutput = String(mailboxData.errorOutput || '').trim();
				const messageParts = [`Exit code: ${exitCode}`];
				if (output) {
					messageParts.push(`Output: ${output}`);
				}
				if (errorOutput) {
					messageParts.push(`Error output: ${errorOutput}`);
				}
				lines.push(
					`✅ Step ${mailboxStep}/${totalSteps}: Primary account mailbox configured. ${messageParts.join(' | ')}`,
				);
			} catch (mailboxErr) {
				allStepsSucceeded = false;
				lines.push(
					`❌ Step ${mailboxStep}/${totalSteps}: Failed to set primary account mailbox: ${
						mailboxErr instanceof Error ? mailboxErr.message : 'Unknown error'
					}`,
				);
			}
		}

		if (createFreescoutUser.value) {
			lines.push(`⏳ Step ${freescoutStep}/${totalSteps}: Pre-creating FreeScout user...`);
			try {
				const freescoutBody = new URLSearchParams({
					email: email.value,
					fullName: fullName.value,
				});
				const freescoutData = await apiRequest<FreescoutUserResponse>(
					OC.generateUrl('/apps/hufak/api/freescout/user'),
					{
						method: 'POST',
						headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
						body: freescoutBody,
					},
				);
				const freescoutOutput = String(freescoutData.output || '').trim();
				const freescoutErrorOutput = String(freescoutData.errorOutput || '').trim();
				const freescoutSucceeded = freescoutData.exitCode === 0;
				const freescoutParts = [`Exit code: ${freescoutData.exitCode ?? ''}`];
				if (freescoutOutput) {
					freescoutParts.push(`Output: ${freescoutOutput}`);
				}
				if (freescoutErrorOutput) {
					freescoutParts.push(`Error output: ${freescoutErrorOutput}`);
				}
				if (!freescoutSucceeded) {
					allStepsSucceeded = false;
				}
				lines.push(
					`${freescoutSucceeded ? '✅' : '❌'} Step ${freescoutStep}/${totalSteps}: ${
						freescoutData.message || 'FreeScout user creation finished'
					}. ${freescoutParts.join(' | ')}`,
				);
			} catch (freescoutErr) {
				allStepsSucceeded = false;
				lines.push(
					`❌ Step ${freescoutStep}/${totalSteps}: Failed to pre-create FreeScout user: ${
						freescoutErr instanceof Error ? freescoutErr.message : 'Unknown error'
					}`,
				);
			}
		}

		creationOutput.value = lines.join('\n');
		isCreateLocked.value = allStepsSucceeded;
	} catch (err) {
		creationOutput.value = `❌ Step 1/${totalSteps} failed: ${
			err instanceof Error ? err.message : 'Account creation failed'
		}`;
		isCreateLocked.value = false;
	} finally {
		isCreating.value = false;
	}
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Create new account</h2>
		</div>
		<form :style="styles.form" autocomplete="off" @submit.prevent="onSubmit">
			<label :style="styles.fieldLabel" for="hufak-full-name">Full name</label>
			<input
				id="hufak-full-name"
				type="text"
				:value="fullName"
				autocomplete="off"
				name="hufak-create-full-name"
				:disabled="isCreating"
				:placeholder="fullNamePlaceholder"
				:style="inputStyle"
				@input="onFullNameInput">
			<p v-if="fullName.length > 0 && !isFullNameValid" :style="styles.validationMessage">
				Use two or more words. Each word must start with a capital letter and contain
				letters only.
			</p>

			<label :style="styles.fieldLabel" for="hufak-pronouns">Pronouns</label>
			<div :style="styles.pronounsRow">
				<input
					id="hufak-pronouns"
					v-model="pronouns"
					type="text"
					autocomplete="off"
					name="hufak-create-pronouns"
					:disabled="isCreating"
					:style="inputStyle"
					@input="touch">
				<div :style="styles.quickFillLinks">
					<button
						type="button"
						:disabled="isCreating"
						:style="styles.quickFillLink"
						@click="setPronounsQuickFill('sie/sie she/her')">
						she/her
					</button>
					<button
						type="button"
						:disabled="isCreating"
						:style="styles.quickFillLink"
						@click="setPronounsQuickFill('er/ihn he/him')">
						he/him
					</button>
					<button
						type="button"
						:disabled="isCreating"
						:style="styles.quickFillLink"
						@click="setPronounsQuickFill('they/them')">
						they/them
					</button>
				</div>
			</div>

			<label :style="styles.fieldLabel" for="hufak-username">Username</label>
			<input
				id="hufak-username"
				v-model="username"
				type="text"
				autocomplete="off"
				name="hufak-create-username"
				:disabled="isCreating"
				:placeholder="usernamePlaceholder"
				:style="inputStyle"
				@input="touch">

			<label :style="styles.fieldLabel" for="hufak-email">Account email</label>
			<div :style="styles.fieldWithNoteRow">
				<input
					id="hufak-email"
					v-model="email"
					type="email"
					autocomplete="off"
					name="hufak-create-email"
					:disabled="isCreating"
					:placeholder="emailPlaceholder"
					:style="inputStyle"
					@input="touch">
				<p :style="styles.hintText">
					Note: create e-mail forward or account in
					<a
						href="https://kas.all-inkl.com/email/email-account/"
						target="_blank"
						rel="noreferrer"
						:style="styles.inlineLink">KAS</a>
					first
				</p>
			</div>
			<div :style="styles.proseContent">
				<p :style="styles.hintText">Default domain from configuration: {{ emailDomain }}</p>
			</div>

			<span :style="styles.fieldLabel">Login details</span>
			<div :style="styles.radioGroup">
				<label :style="styles.radioOption" for="hufak-login-welcome-email">
					<input
						id="hufak-login-welcome-email"
						type="radio"
						name="hufak-create-login-delivery"
						:checked="sendWelcomeEmail"
						:disabled="isCreating"
						@change="sendWelcomeEmail = true; touch()">
					<span>
						Send login details to the account email with a welcome email
						<span :style="styles.hintText">
							(the email contains the username and a link to set a password —
							Nextcloud never sends passwords by email)
						</span>
					</span>
				</label>
				<label :style="styles.radioOption" for="hufak-login-random-password">
					<input
						id="hufak-login-random-password"
						type="radio"
						name="hufak-create-login-delivery"
						:checked="!sendWelcomeEmail"
						:disabled="isCreating"
						@change="sendWelcomeEmail = false; touch()">
					<span>
						Generate a random password and show it here
						<span :style="styles.hintText">(no email is sent; hand the password over yourself)</span>
					</span>
				</label>
			</div>

			<label :style="styles.radioOption" for="hufak-create-freescout-user">
				<input
					id="hufak-create-freescout-user"
					v-model="createFreescoutUser"
					type="checkbox"
					name="hufak-create-freescout-user"
					:disabled="isCreating"
					@change="touch">
				<span>
					pre-create FreeScout user (experimental)
					<span :style="styles.hintText">
						(runs artisan freescout:create-user, so the account exists before the first
						OAuth login — the module matches it by account email)
					</span>
				</span>
			</label>

			<details :style="styles.collapsibleSection">
				<summary :style="styles.collapsibleSummary">NextSnapMail settings</summary>
				<div :style="styles.collapsibleContent">
					<MailboxCredentialsFields
						label="Primary mailbox (optional)"
						email-id="hufak-default-email-account"
						password-id="hufak-default-email-account-password"
						email-name="hufak-create-mailbox-email"
						password-name="hufak-create-mailbox-password"
						:email="defaultEmailAccount"
						:password="defaultEmailAccountPassword"
						:disabled="isCreating"
						email-placeholder="e.g. bipol@hufak.net"
						@update:email="defaultEmailAccount = $event; touch()"
						@update:password="defaultEmailAccountPassword = $event; touch()" />
				</div>
			</details>

			<div :style="styles.buttonRow">
				<button
					type="submit"
					:disabled="!isFullNameValid || isCreating || isCreateLocked"
					:style="styles.submitButton">
					{{ isCreating ? 'Creating...' : 'Create' }}
				</button>
				<button
					type="button"
					:disabled="isCreating"
					:style="styles.clearButton"
					@click="onClearForm">
					Clear
				</button>
			</div>
			<textarea
				readonly
				:value="creationOutput"
				name="hufak-create-output"
				autocomplete="off"
				:style="styles.outputBox"
				placeholder="Status messages from user creation will appear here." />
		</form>
	</section>
</template>
