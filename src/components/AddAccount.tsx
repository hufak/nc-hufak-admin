import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { buildEmailFromUsername, fullNameIsValid, usernameFromFullName } from '../utils/userUtils';
import { styles } from '../styles';
import { MailboxCredentialsFields } from './MailboxCredentialsFields';
import type {
	ApporderResetResponse,
	SnappyMailSettingsResponse,
	UserCreateResponse,
} from '../types';

interface AddAccountProps {
	emailDomain: string
}

function AddAccount({ emailDomain }: AddAccountProps): ReactElement {
	const fullNamePlaceholder = 'John Doe';
	const usernamePlaceholder = usernameFromFullName(fullNamePlaceholder);
	const emailPlaceholder = buildEmailFromUsername(usernamePlaceholder, emailDomain);
	const [fullName, setFullName] = useState('');
	const [pronouns, setPronouns] = useState('');
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState('');
	const [defaultEmailAccount, setDefaultEmailAccount] = useState('');
	const [defaultEmailAccountPassword, setDefaultEmailAccountPassword] = useState('');
	const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
	const [isCreating, setIsCreating] = useState(false);
	const [isCreateLocked, setIsCreateLocked] = useState(false);
	const [creationOutput, setCreationOutput] = useState('');
	const isFullNameValid = fullNameIsValid(fullName);

	const onFullNameChange = (event: ChangeEvent<HTMLInputElement>) => {
		const nextFullName = event.target.value;
		setFullName(nextFullName);
		setIsCreateLocked(false);
		setUsername(usernameFromFullName(nextFullName));
	};

	const onPronounsChange = (event: ChangeEvent<HTMLInputElement>) => {
		setPronouns(event.target.value);
		setIsCreateLocked(false);
	};

	const setPronounsQuickFill = (nextPronouns: string) => {
		setPronouns(nextPronouns);
		setIsCreateLocked(false);
	};

	const onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value);
		setIsCreateLocked(false);
	};

	const onEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
		setEmail(event.target.value);
		setIsCreateLocked(false);
	};

	useEffect(() => {
		setEmail(username.trim() === '' ? '' : buildEmailFromUsername(username, emailDomain));
	}, [username, emailDomain]);

	const onClearForm = () => {
		setFullName('');
		setPronouns('');
		setUsername('');
		setEmail('');
		setDefaultEmailAccount('');
		setDefaultEmailAccountPassword('');
		setSendWelcomeEmail(true);
		setCreationOutput('');
		setIsCreateLocked(false);
	};

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!isFullNameValid) {
			setCreationOutput(
				'❌ Validation failed: full name must contain at least two capitalized words.',
			);
			return;
		}

		const shouldConfigureDefaultMailbox =
			defaultEmailAccount.trim() !== '' && defaultEmailAccountPassword !== '';
		const totalSteps = shouldConfigureDefaultMailbox ? 3 : 2;
		const createdUid = String(username || '').trim();
		let allStepsSucceeded = true;

		setIsCreating(true);
		setIsCreateLocked(false);
		setCreationOutput(`⏳ Step 1/${totalSteps}: Creating account...`);

		try {
			const body = new URLSearchParams({
				fullName,
				pronoun: pronouns,
				username,
				email,
				sendWelcomeEmail: sendWelcomeEmail ? '1' : '0',
			});
			const data = await apiRequest<UserCreateResponse>(OC.generateUrl('/apps/hufak/api/accounts'), {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			});
			const actualCreatedUid = String(data.username || createdUid);
			const lines = [
				`✅ Step 1/${totalSteps}: ${data.message || `Account "${actualCreatedUid}" created successfully`}`,
			];
			if (data.welcomeEmailSent) {
				lines.push(`📧 Welcome email with password setup link sent to ${email}`);
			} else if (data.welcomeEmailError) {
				lines.push(`⚠️ Welcome email to ${email} could not be sent: ${data.welcomeEmailError}`);
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
					{
						method: 'POST',
					},
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

			if (shouldConfigureDefaultMailbox) {
				lines.push(`⏳ Step 3/${totalSteps}: Setting primary account mailbox...`);
				try {
					const mailboxBody = new URLSearchParams({
						uid: actualCreatedUid,
						email: defaultEmailAccount.trim(),
						password: defaultEmailAccountPassword,
					});
					const mailboxData = await apiRequest<SnappyMailSettingsResponse>(
						OC.generateUrl('/apps/hufak/api/snappymail/settings'),
						{
							method: 'POST',
							headers: {
								'content-type':
									'application/x-www-form-urlencoded;charset=UTF-8',
							},
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
						`✅ Step 3/${totalSteps}: Primary account mailbox configured. ${messageParts.join(' | ')}`,
					);
				} catch (step3Err) {
					allStepsSucceeded = false;
					lines.push(
						`❌ Step 3/${totalSteps}: Failed to set primary account mailbox: ${
							step3Err instanceof Error ? step3Err.message : 'Unknown error'
						}`,
					);
				}
			}

			setCreationOutput(lines.join('\n'));
			setIsCreateLocked(allStepsSucceeded);
		} catch (err) {
			allStepsSucceeded = false;
			setCreationOutput(
				`❌ Step 1/${totalSteps} failed: ${err instanceof Error ? err.message : 'Account creation failed'}`,
			);
			setIsCreateLocked(false);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<div style={styles.proseContent}>
				<h2>Create new account</h2>
			</div>
			<form onSubmit={onSubmit} style={styles.form} autoComplete="off">
				<label style={styles.fieldLabel} htmlFor="hufak-full-name">
					Full name
				</label>
				<input
					id="hufak-full-name"
					type="text"
					value={fullName}
					onChange={onFullNameChange}
					autoComplete="off"
					name="hufak-create-full-name"
					disabled={isCreating}
					placeholder={fullNamePlaceholder}
					style={{ ...styles.input, ...styles.addUserInput }}
				/>
				{fullName.length > 0 && !isFullNameValid && (
					<p style={styles.validationMessage}>
						Use two or more words. Each word must start with a capital letter and
						contain letters only.
					</p>
				)}

				<label style={styles.fieldLabel} htmlFor="hufak-pronouns">
					Pronouns
				</label>
				<div style={styles.pronounsRow}>
					<input
						id="hufak-pronouns"
						type="text"
						value={pronouns}
					onChange={onPronounsChange}
					autoComplete="off"
					name="hufak-create-pronouns"
					disabled={isCreating}
					style={{ ...styles.input, ...styles.addUserInput }}
				/>
					<div style={styles.quickFillLinks}>
						<button
							type="button"
							onClick={() => setPronounsQuickFill('sie/sie she/her')}
							disabled={isCreating}
							style={styles.quickFillLink}
						>
							she/her
						</button>
						<button
							type="button"
							onClick={() => setPronounsQuickFill('er/ihn he/him')}
							disabled={isCreating}
							style={styles.quickFillLink}
						>
							he/him
						</button>
						<button
							type="button"
							onClick={() => setPronounsQuickFill('they/them')}
							disabled={isCreating}
							style={styles.quickFillLink}
						>
							they/them
						</button>
					</div>
				</div>

				<label style={styles.fieldLabel} htmlFor="hufak-username">
					Username
				</label>
				<input
					id="hufak-username"
					type="text"
					value={username}
					onChange={onUsernameChange}
					autoComplete="off"
					name="hufak-create-username"
					disabled={isCreating}
					placeholder={usernamePlaceholder}
					style={{ ...styles.input, ...styles.addUserInput }}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-email">
					Account email
				</label>
				<div style={styles.fieldWithNoteRow}>
					<input
						id="hufak-email"
						type="email"
						value={email}
						onChange={onEmailChange}
						autoComplete="off"
						name="hufak-create-email"
						disabled={isCreating}
						placeholder={emailPlaceholder}
						style={{ ...styles.input, ...styles.addUserInput }}
					/>
					<p style={styles.hintText}>
						Note: create e-mail forward or account in{' '}
						<a
							href="https://kas.all-inkl.com/email/email-account/"
							target="_blank"
							rel="noreferrer"
							style={styles.inlineLink}
						>
							KAS
						</a>{' '}
						first
					</p>
				</div>
				<div style={styles.proseContent}>
					<p style={styles.hintText}>Default domain from configuration: {emailDomain}</p>
				</div>

				<span style={styles.fieldLabel}>Login details</span>
				<div style={styles.radioGroup}>
					<label style={styles.radioOption} htmlFor="hufak-login-welcome-email">
						<input
							id="hufak-login-welcome-email"
							type="radio"
							name="hufak-create-login-delivery"
							checked={sendWelcomeEmail}
							onChange={() => {
								setSendWelcomeEmail(true);
								setIsCreateLocked(false);
							}}
							disabled={isCreating}
						/>
						<span>
							Send login details to the account email with a welcome email
							<span style={styles.hintText}>
								{' '}
								(the email contains the username and a link to set a password —
								Nextcloud never sends passwords by email)
							</span>
						</span>
					</label>
					<label style={styles.radioOption} htmlFor="hufak-login-random-password">
						<input
							id="hufak-login-random-password"
							type="radio"
							name="hufak-create-login-delivery"
							checked={!sendWelcomeEmail}
							onChange={() => {
								setSendWelcomeEmail(false);
								setIsCreateLocked(false);
							}}
							disabled={isCreating}
						/>
						<span>
							Generate a random password and show it here
							<span style={styles.hintText}>
								{' '}
								(no email is sent; hand the password over yourself)
							</span>
						</span>
					</label>
				</div>

				<details style={styles.collapsibleSection}>
					<summary style={styles.collapsibleSummary}>Snappymail settings</summary>
					<div style={styles.collapsibleContent}>
						<MailboxCredentialsFields
							label="Primary mailbox (optional)"
							emailId="hufak-default-email-account"
							passwordId="hufak-default-email-account-password"
							emailName="hufak-create-mailbox-email"
							passwordName="hufak-create-mailbox-password"
							email={defaultEmailAccount}
							password={defaultEmailAccountPassword}
							onEmailChange={(value) => {
								setDefaultEmailAccount(value);
								setIsCreateLocked(false);
							}}
							onPasswordChange={(value) => {
								setDefaultEmailAccountPassword(value);
								setIsCreateLocked(false);
							}}
							disabled={isCreating}
							emailPlaceholder="e.g. bipol@hufak.net"
						/>
					</div>
				</details>

				<div style={styles.buttonRow}>
					<button
						type="submit"
						disabled={!isFullNameValid || isCreating || isCreateLocked}
						style={styles.submitButton}
					>
						{isCreating ? 'Creating...' : 'Create'}
					</button>
					<button
						type="button"
						onClick={onClearForm}
						disabled={isCreating}
						style={styles.clearButton}
					>
						Clear
					</button>
				</div>
				<textarea
					readOnly
					value={creationOutput}
					name="hufak-create-output"
					autoComplete="off"
					style={styles.outputBox}
					placeholder="Status messages from user creation will appear here."
				/>
			</form>
		</section>
	);
}

export { AddAccount };
