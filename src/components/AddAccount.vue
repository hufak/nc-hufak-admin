<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch, type CSSProperties } from 'vue';
import { apiRequest } from '../api';
import { buildEmailFromUsername, fullNameIsValid, usernameFromFullName } from '../utils/userUtils';
import { escapeHtml, replaceNewAccountTemplateVariables } from '../utils/newAccountTemplate';
import { styles } from '../styles';
import NcSelect from '@nextcloud/vue/components/NcSelect';
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch';
import NcRadioGroup from '@nextcloud/vue/components/NcRadioGroup';
import NcTextField from '@nextcloud/vue/components/NcTextField';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcPopover from '@nextcloud/vue/components/NcPopover';
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard';
import AccountCredentialsModal from './AccountCredentialsModal.vue';
import MailboxCredentialsFields from './MailboxCredentialsFields.vue';
import type {
	ApporderResetResponse,
	FreescoutUserResponse,
	KasMailboxCreateResponse,
	SnappyMailSettingsResponse,
	UserCreateResponse,
	NewAccountTemplateResponse,
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
const additionalEmailAccounts = ref<string[]>([]);
const kasMailboxes = ref<string[]>([]);
const isLoadingKasMailboxes = ref(false);
const hasAttemptedKasMailboxLoad = ref(false);
const kasMailboxesError = ref('');
const sendWelcomeEmail = ref(false);
const createFreescoutUser = ref(true);
const createAllInklMailbox = ref(true);
const dryRun = ref(false);
const kasCredentialsModalOpen = ref(false);
const temporaryKasLogin = ref('');
const temporaryKasPassword = ref('');
const isCreating = ref(false);
const isCreateLocked = ref(false);
const creationOutput = ref('');
const creationProgressModalOpen = ref(false);
const printableNewAccountMarkdown = ref('');
const newAccountMarkdownElement = ref<HTMLElement | null>(null);
type KasCredentials = { login: string; password: string };
let resolveKasCredentials: ((credentials: KasCredentials | null) => void) | null = null;

const NcRichText = defineAsyncComponent(async () =>
	(await import(/* webpackChunkName: 'richtext' */ '../richtext')).NcRichText);

const isFullNameValid = computed(() => fullNameIsValid(fullName.value));
const mailboxToggleStyle: CSSProperties = { whiteSpace: 'nowrap' };
const additionalMailboxSelectStyle: CSSProperties = { width: 'min(100%, 52ch)' };
const emailAccessSubitemStyle: CSSProperties = { marginInlineStart: '28px', paddingInlineStart: '12px', borderInlineStart: '2px solid var(--color-border)' };
const accountTextFieldContainerStyle: CSSProperties = { width: 'min(100%, 36ch)' };
const pronounsRowStyle: CSSProperties = { ...styles.pronounsRow, flexWrap: 'nowrap' };
const pronounsFieldContainerStyle: CSSProperties = { flex: '0 0 36ch', width: '36ch' };
const freescoutOptionStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '4px' };
const subordinateCheckboxNoteStyle: CSSProperties = {
	marginInlineStart: '28px',
	maxWidth: 'min(var(--hufak-prose), calc(100% - 28px))',
};
const tooltipContentStyle: CSSProperties = { maxWidth: '32ch', padding: '10px 12px', margin: 0 };
const creationModalCardStyle: CSSProperties = { width: 'min(calc(80ch + 32px), 96vw)' };
const creationOutputStyle: CSSProperties = { ...styles.outputBox, width: '80ch', maxWidth: '100%', minHeight: '24em' };
const setLoginDelivery = (delivery: string) => {
	sendWelcomeEmail.value = delivery === 'welcome-email';
	touch();
};

const closeCreationProgressModal = () => {
	if (!isCreating.value) {
		creationProgressModalOpen.value = false;
	}
};

const printAccountDetails = async () => {
	const printWindow = window.open('', '_blank');
	if (printWindow === null) {
		return;
	}
	printWindow.opener = null;
	printWindow.document.write('<!doctype html><title>Preparing account details</title><p>Preparing account details…</p>');
	printWindow.document.close();
	let mailServerHost = 'Not available';
	let template = '# New account details\n\n{{creation_log}}';
	const [mailServerResult, templateResult] = await Promise.allSettled([
		apiRequest<{ host?: string }>(OC.generateUrl('/apps/hufak/api/kas/mail-server-settings')),
		apiRequest<NewAccountTemplateResponse>(OC.generateUrl('/apps/hufak/api/settings/new-account')),
	]);
	if (mailServerResult.status === 'fulfilled') {
		mailServerHost = String(mailServerResult.value.host || mailServerHost);
	}
	if (templateResult.status === 'fulfilled' && typeof templateResult.value.template === 'string') {
		template = templateResult.value.template;
	}
	const accountName = username.value.trim() || 'New account';
	const cloudPassword = creationOutput.value.match(/^🔐 Generated password: (.+)$/m)?.[1] ?? 'Set through the welcome-email link';
	const mailboxPassword = creationOutput.value.match(/^🔐 Generated mailbox password \(show once\): (.+)$/m)?.[1] ?? 'Not shown in the creation log';
	const cloudUrl = `${window.location.origin}${OC.generateUrl('/')}`;
	const emailAccountCreated = /ALL-INKL mailbox .* created before the Nextcloud account\./.test(creationOutput.value);
	printableNewAccountMarkdown.value = replaceNewAccountTemplateVariables(template, {
		cloud_url: cloudUrl,
		login_email: email.value,
		cloud_password: cloudPassword,
		private_email: email.value,
		email_account_status: emailAccountCreated
			? 'A new Hufak email mailbox was created.'
			: 'No new Hufak email mailbox was created during this run.',
		imap_server: mailServerHost,
		imap_port: '993',
		smtp_server: mailServerHost,
		smtp_port: '465',
		mailbox_username: email.value,
		mailbox_password: mailboxPassword,
		creation_log: creationOutput.value,
	});
	await import(/* webpackChunkName: 'richtext' */ '../richtext');
	await nextTick();
	const renderedTemplate = newAccountMarkdownElement.value?.innerHTML
		?? `<pre>${escapeHtml(printableNewAccountMarkdown.value)}</pre>`;
	if (printWindow.closed) {
		return;
	}
	printWindow.document.open();
	printWindow.document.write(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Account details: ${escapeHtml(accountName)}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;max-width:800px;color:#111}h1{font-size:26px;margin:0 0 24px}h2{font-size:18px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #bbb}h3{font-size:16px;margin:22px 0 8px}p,li{line-height:1.45}ul{padding-left:22px}code{font-family:ui-monospace,monospace}pre{white-space:pre-wrap;overflow-wrap:break-word;border:1px solid #bbb;border-radius:6px;padding:16px;font:12px/1.45 ui-monospace,monospace}a{color:#004a8f;text-decoration:underline}@media print{body{margin:16mm}}</style>
</head><body>${renderedTemplate}</body></html>`);
	printWindow.document.close();
	printWindow.focus();
	window.setTimeout(() => printWindow.print(), 0);
};

watch([username, () => props.emailDomain], () => {
	email.value = username.value.trim() === ''
		? ''
		: buildEmailFromUsername(username.value, props.emailDomain);
});

const onFullNameInput = (value: string | number) => {
	const nextFullName = String(value);
	fullName.value = nextFullName;
	isCreateLocked.value = false;
	username.value = usernameFromFullName(nextFullName);
};

const touch = () => {
	isCreateLocked.value = false;
};

const closeKasCredentialsModal = () => {
	kasCredentialsModalOpen.value = false;
	temporaryKasLogin.value = '';
	temporaryKasPassword.value = '';
	const resolve = resolveKasCredentials;
	resolveKasCredentials = null;
	resolve?.(null);
};

const requestKasCredentials = () => new Promise<KasCredentials | null>((resolve) => {
	resolveKasCredentials = resolve;
	kasCredentialsModalOpen.value = true;
});

const saveKasCredentials = () => {
	if (temporaryKasLogin.value.trim() === '' || temporaryKasPassword.value === '') {
		return;
	}
	const credentials: KasCredentials = {
		login: temporaryKasLogin.value.trim(),
		password: temporaryKasPassword.value,
	};
	kasCredentialsModalOpen.value = false;
	temporaryKasLogin.value = '';
	temporaryKasPassword.value = '';
	const resolve = resolveKasCredentials;
	resolveKasCredentials = null;
	resolve?.(credentials);
	touch();
};
const loadKasMailboxes = async () => {
	if (isLoadingKasMailboxes.value || hasAttemptedKasMailboxLoad.value) return;
	hasAttemptedKasMailboxLoad.value = true;
	isLoadingKasMailboxes.value = true; kasMailboxesError.value = '';
	try {
		const data = await apiRequest<{ mailboxes?: string[] }>(OC.generateUrl('/apps/hufak/api/kas/mailbox-addresses'));
		kasMailboxes.value = data.mailboxes || [];
	} catch (err) { kasMailboxesError.value = err instanceof Error ? err.message : 'Failed to load KAS mailboxes'; }
	finally { isLoadingKasMailboxes.value = false; }
};
const onMailboxCreationChange = (enabled: boolean) => {
	if (enabled) {
		void loadKasMailboxes();
	}
	touch();
};

const createKasMailbox = (uid: string, emailAddress: string, credentials?: KasCredentials) => {
	const body = new URLSearchParams({ email: emailAddress });
	if (credentials) {
		body.set('kasLogin', credentials.login);
		body.set('kasPassword', credentials.password);
	}
	return apiRequest<KasMailboxCreateResponse>(
		OC.generateUrl(`/apps/hufak/api/accounts/${encodeURIComponent(uid)}/kas-mailbox`),
		{
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body,
		},
	);
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
	additionalEmailAccounts.value = [];
	sendWelcomeEmail.value = false;
	createFreescoutUser.value = true;
	createAllInklMailbox.value = true;
	dryRun.value = false;
	closeKasCredentialsModal();
	creationOutput.value = '';
	isCreateLocked.value = false;
};

const onSubmit = async () => {
	if (!isFullNameValid.value) {
		creationOutput.value =
			'❌ Validation failed: full name must contain at least two capitalized words.';
		return;
	}

	const automaticMailboxSteps = createAllInklMailbox.value ? 2 + (sendWelcomeEmail.value ? 1 : 0) : 0;
	const totalSteps = 3 + automaticMailboxSteps + (createFreescoutUser.value ? 1 : 0);
	const accountStep = createAllInklMailbox.value ? 2 : 1;
	const appOrderStep = accountStep + 1;
	const dashboardStep = appOrderStep + 1;
	const mailboxStep = dashboardStep;
	const freescoutStep = dashboardStep + (createAllInklMailbox.value ? 1 + (sendWelcomeEmail.value ? 1 : 0) : 0) + 1;
	const createdUid = String(username.value || '').trim();
	let allStepsSucceeded = true;
	if (dryRun.value) {
		creationProgressModalOpen.value = true;
		isCreating.value = true;
		creationOutput.value = `⏳ Dry run: no account, mailbox, or external command will be created.\n\n`
			+ (createAllInklMailbox.value
				? `Would first create ALL-INKL mailbox: ${email.value}. If that failed, no Nextcloud account would be created.\n`
				: '')
			+ `Would then create Nextcloud account: ${createdUid}\n`
			+ `Would set account email: ${email.value}\n`
			+ `Would set app order and dashboard defaults.\n`
			+ (createAllInklMailbox.value
				? `Would configure the mailbox as the primary NextSnapMail account.\n`
				: '')
			+ (additionalEmailAccounts.value.length > 0
				? `Would add NextSnapMail access to: ${additionalEmailAccounts.value.join(', ')}.\n`
				: '')
			+ (sendWelcomeEmail.value
				? 'Would send the welcome email.\n'
				: 'Would generate a password for in-person handover (no password is generated during a dry run).\n')
			+ (createFreescoutUser.value
				? 'Would pre-create the FreeScout user.\n'
				: '')
			+ '\n✅ Dry run finished: no changes were made.';
		isCreating.value = false;
		isCreateLocked.value = false;
		return;
	}

	isCreating.value = true;
	isCreateLocked.value = false;
	creationProgressModalOpen.value = true;
	creationOutput.value = '';
	let precreatedKasMailbox: KasMailboxCreateResponse | null = null;
	if (createAllInklMailbox.value) {
		creationOutput.value = `⏳ Step 1/${totalSteps}: Creating ALL-INKL mailbox...`;
		try {
			try {
				precreatedKasMailbox = await createKasMailbox(createdUid, email.value);
			} catch (serverCredentialsError) {
				creationOutput.value = '⚠️ Server-provided KAS credentials failed. Enter credentials to retry mailbox creation.';
				const credentials = await requestKasCredentials();
				if (credentials === null) throw serverCredentialsError;
				precreatedKasMailbox = await createKasMailbox(createdUid, email.value, credentials);
			}
		} catch (mailboxErr) {
			creationOutput.value = `❌ ALL-INKL mailbox creation failed; the Nextcloud account was not created: ${mailboxErr instanceof Error ? mailboxErr.message : 'Unknown error'}`;
			isCreating.value = false;
			return;
		}
	}
	creationOutput.value = `⏳ Step ${accountStep}/${totalSteps}: Creating account...`;

	try {
		const body = new URLSearchParams({
			fullName: fullName.value,
			pronoun: pronouns.value,
			username: username.value,
			email: email.value,
			sendWelcomeEmail: sendWelcomeEmail.value ? '1' : '0',
			deferWelcomeEmail: createAllInklMailbox.value && sendWelcomeEmail.value ? '1' : '0',
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
			`✅ Step ${accountStep}/${totalSteps}: ${data.message || `Account "${actualCreatedUid}" created successfully`}`,
		];
		if (precreatedKasMailbox) {
			lines.unshift(`✅ ALL-INKL mailbox ${email.value} created before the Nextcloud account.`);
		}
		if (data.welcomeEmailSent) {
			lines.push(`📧 Welcome email with password setup link sent to ${email.value}`);
		} else if (data.welcomeEmailError) {
			lines.push(`⚠️ Welcome email to ${email.value} could not be sent: ${data.welcomeEmailError}`);
		}
		if (data.password) {
			lines.push(`🔐 Generated password: ${data.password}`);
		}

		lines.push(`⏳ Step ${appOrderStep}/${totalSteps}: Setting app order defaults...`);
		try {
			const resetData = await apiRequest<ApporderResetResponse>(
				OC.generateUrl(
					`/apps/hufak/api/accounts/${encodeURIComponent(actualCreatedUid)}/apporder/default`,
				),
				{ method: 'POST' },
			);
			lines.push(`✅ Step ${appOrderStep}/${totalSteps}: ${resetData.message || 'App order defaults set'}`);
		} catch (step2Err) {
			allStepsSucceeded = false;
			lines.push(
				`❌ Step ${appOrderStep}/${totalSteps}: Failed to set app order defaults: ${
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

		if (createAllInklMailbox.value) {
			try {
				const mailboxPassword = String(precreatedKasMailbox?.mailboxPassword || '');
				if (mailboxPassword === '') {
					throw new Error('ALL-INKL did not return the generated mailbox password');
				}
				lines.push(`🔐 Generated mailbox password (show once): ${mailboxPassword}`);

				const configurationStep = mailboxStep + 1;
				lines.push(`⏳ Step ${configurationStep}/${totalSteps}: Configuring primary NextSnapMail mailbox...`);
				const mailboxData = await apiRequest<SnappyMailSettingsResponse>(
					OC.generateUrl('/apps/hufak/api/snappymail/settings'),
					{
						method: 'POST',
						headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
						body: new URLSearchParams({ uid: actualCreatedUid, email: email.value, password: mailboxPassword }),
					},
				);
				if (mailboxData.exitCode !== 0) {
					throw new Error(mailboxData.errorOutput || mailboxData.message || 'NextSnapMail configuration failed');
				}
				lines.push(`✅ Step ${configurationStep}/${totalSteps}: Primary NextSnapMail mailbox configured.`);
				for (const additionalEmailAccount of additionalEmailAccounts.value) {
					await apiRequest(OC.generateUrl('/apps/hufak/api/snappymail/additional-account'), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: new URLSearchParams({ uid: actualCreatedUid, email: additionalEmailAccount, useKasPassword: '1' }) });
					lines.push(`✅ Additional mailbox ${additionalEmailAccount} configured.`);
				}

				if (sendWelcomeEmail.value) {
					const welcomeStep = configurationStep + 1;
					lines.push(`⏳ Step ${welcomeStep}/${totalSteps}: Sending welcome email...`);
					const welcomeData = await apiRequest<{ message?: string }>(
						OC.generateUrl(`/apps/hufak/api/accounts/${encodeURIComponent(actualCreatedUid)}/welcome-email`),
						{ method: 'POST' },
					);
					lines.push(`✅ Step ${welcomeStep}/${totalSteps}: ${welcomeData.message || 'Welcome email sent'}`);
				}
			} catch (mailboxErr) {
				allStepsSucceeded = false;
				lines.push(`❌ Automatic mailbox setup failed: ${mailboxErr instanceof Error ? mailboxErr.message : 'Unknown error'}`);
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
			<div :style="accountTextFieldContainerStyle">
				<NcTextField id="hufak-full-name" :model-value="fullName" label="Preferred name (given + family name)" type="text" autocomplete="off" name="hufak-create-full-name" :disabled="isCreating" :placeholder="fullNamePlaceholder" :error="fullName.length > 0 && !isFullNameValid" :helper-text="fullName.length > 0 && !isFullNameValid ? 'Use two or more words. Each word must start with a capital letter and contain letters only.' : ''" @update:model-value="onFullNameInput" />
			</div>
			<div :style="pronounsRowStyle">
				<div :style="pronounsFieldContainerStyle">
					<NcTextField id="hufak-pronouns" v-model="pronouns" label="Pronouns" type="text" autocomplete="off" name="hufak-create-pronouns" :disabled="isCreating" @update:model-value="touch" />
				</div>
				<div :style="styles.quickFillLinks">
					<button type="button" :disabled="isCreating" :style="styles.quickFillLink" @click="setPronounsQuickFill('sie/sie she/her')">she/her</button>
					<button type="button" :disabled="isCreating" :style="styles.quickFillLink" @click="setPronounsQuickFill('er/ihn he/him')">he/him</button>
					<button type="button" :disabled="isCreating" :style="styles.quickFillLink" @click="setPronounsQuickFill('they/them')">they/them</button>
				</div>
			</div>
			<h3 :style="styles.subheading">Cloud account</h3>
			<div :style="accountTextFieldContainerStyle">
				<NcTextField id="hufak-username" v-model="username" label="Username" type="text" autocomplete="off" name="hufak-create-username" :disabled="isCreating" :placeholder="usernamePlaceholder" @update:model-value="touch" />
			</div>

			<NcRadioGroup
				label="Password"
				:model-value="sendWelcomeEmail ? 'welcome-email' : 'random-password'"
				:disabled="isCreating"
				@update:model-value="setLoginDelivery">
				<NcCheckboxRadioSwitch
						id="hufak-login-random-password"
						name="hufak-create-login-delivery"
						value="random-password"
						:disabled="isCreating"
						description="No email is sent; hand the password over yourself.">
					Generate a random password here, give it to the user in person
				</NcCheckboxRadioSwitch>
				<NcCheckboxRadioSwitch
						id="hufak-login-welcome-email"
						name="hufak-create-login-delivery"
						value="welcome-email"
						:disabled="isCreating"
						description="The email contains the username and a link to set a password — Nextcloud never sends passwords by email.">
					Send login details to the account email with a welcome email
				</NcCheckboxRadioSwitch>
			</NcRadioGroup>

			<h3 :style="styles.subheading">Email access</h3>
			<div :style="accountTextFieldContainerStyle">
				<NcTextField id="hufak-email" v-model="email" label="Email accounts" type="email" autocomplete="off" name="hufak-create-email" :disabled="isCreating" :placeholder="emailPlaceholder" @update:model-value="touch" />
			</div>
			<NcCheckboxRadioSwitch id="hufak-create-allinkl-mailbox" v-model="createAllInklMailbox" :disabled="isCreating" :style="mailboxToggleStyle" @update:model-value="onMailboxCreationChange">
				create new mailbox via KAS API and set as NextSnapMail primary email
			</NcCheckboxRadioSwitch>
			<div :style="emailAccessSubitemStyle">
				<NcSelect
					v-model="additionalEmailAccounts"
					:options="kasMailboxes"
					:multiple="true"
					:searchable="true"
					:keep-open="true"
					:disabled="!createAllInklMailbox || isCreating"
					:loading="isLoadingKasMailboxes"
					input-label="add NextSnapMail access to department accounts:"
					placeholder="No additional mailbox"
					:style="additionalMailboxSelectStyle"
					@open="loadKasMailboxes"
					@update:model-value="touch" />
				<p v-if="isLoadingKasMailboxes" :style="styles.hintText">Loading KAS mailboxes…</p>
				<p v-if="kasMailboxesError" :style="styles.validationMessage">{{ kasMailboxesError }}</p>
			</div>
			<div>
				<div :style="freescoutOptionStyle">
					<NcCheckboxRadioSwitch id="hufak-create-freescout-user" v-model="createFreescoutUser" :disabled="isCreating" @update:model-value="touch">
						pre-create FreeScout user (experimental)
					</NcCheckboxRadioSwitch>
					<NcPopover :triggers="['hover', 'focus']" placement="end" no-focus-trap>
						<template #trigger>
							<NcButton aria-label="About pre-creating a FreeScout user" variant="tertiary-no-background">
								<template #icon><span class="icon icon-info" /></template>
							</NcButton>
						</template>
						<p :style="tooltipContentStyle">Runs artisan freescout:create-user, so the account exists before the first OAuth login — the module matches it by account email.</p>
					</NcPopover>
				</div>
				<div :style="subordinateCheckboxNoteStyle">
					<NcNoteCard type="info" text="Only the Freescout account will be created; a Ticket admin still needs to assign the department mailboxes to the user." />
				</div>
			</div>
			<NcCheckboxRadioSwitch id="hufak-create-dry-run" v-model="dryRun" :disabled="isCreating" @update:model-value="touch">
				dry-run (show planned account creation without making changes)
			</NcCheckboxRadioSwitch>

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
		</form>
		<AccountCredentialsModal v-if="creationProgressModalOpen" :card-style="creationModalCardStyle" @close="closeCreationProgressModal">
			<h4 :style="styles.modalTitle">{{ isCreating ? 'Creating account…' : 'Account creation finished' }}</h4>
			<textarea readonly :value="creationOutput" name="hufak-create-output" autocomplete="off" :style="creationOutputStyle" placeholder="Account creation progress will appear here." />
			<div v-if="!isCreating" :style="styles.modalButtonRow">
				<button type="button" :style="styles.submitButton" @click="printAccountDetails">print account details</button>
				<button type="button" :style="styles.clearButton" @click="closeCreationProgressModal">Close</button>
			</div>
		</AccountCredentialsModal>
		<AccountCredentialsModal v-if="kasCredentialsModalOpen" @close="closeKasCredentialsModal">
			<h4 :style="styles.modalTitle">Temporary KAS credentials</h4>
			<p :style="styles.modalText">
				The server-provided KAS credentials failed. These credentials are used for one mailbox-creation retry only and are not stored.
			</p>
			<form :style="styles.form" autocomplete="off" @submit.prevent="saveKasCredentials">
				<label :style="styles.fieldLabel" for="hufak-create-kas-login">KAS login</label>
				<input id="hufak-create-kas-login" v-model="temporaryKasLogin" :style="styles.input" autocomplete="username">
				<label :style="styles.fieldLabel" for="hufak-create-kas-password">KAS password</label>
				<input id="hufak-create-kas-password" v-model="temporaryKasPassword" type="password" :style="styles.input" autocomplete="current-password">
				<div :style="styles.modalButtonRow">
					<button type="submit" :disabled="!temporaryKasLogin.trim() || !temporaryKasPassword" :style="styles.submitButton">Use credentials</button>
					<button type="button" :style="styles.clearButton" @click="closeKasCredentialsModal">Cancel</button>
				</div>
			</form>
		</AccountCredentialsModal>
		<div v-show="false" ref="newAccountMarkdownElement">
			<NcRichText :text="printableNewAccountMarkdown" use-extended-markdown />
		</div>
	</section>
</template>
