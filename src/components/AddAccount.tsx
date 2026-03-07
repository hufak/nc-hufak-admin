import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { buildEmailFromUsername, fullNameIsValid, usernameFromFullName } from '../utils/userUtils';
import { styles } from '../styles';
import type {
	ApporderResetResponse,
	SnappyMailSettingsResponse,
	UserCreateResponse,
} from '../types';

interface AddAccountProps {
	emailDomain: string
}

function AddAccount({ emailDomain }: AddAccountProps): ReactElement {
	const [fullName, setFullName] = useState('');
	const [pronouns, setPronouns] = useState('');
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState(buildEmailFromUsername('', emailDomain));
	const [defaultEmailAccount, setDefaultEmailAccount] = useState('');
	const [defaultEmailAccountPassword, setDefaultEmailAccountPassword] = useState('');
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

	const onDefaultEmailAccountChange = (event: ChangeEvent<HTMLInputElement>) => {
		setDefaultEmailAccount(event.target.value);
		setIsCreateLocked(false);
	};

	const onDefaultEmailAccountPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
		setDefaultEmailAccountPassword(event.target.value);
		setIsCreateLocked(false);
	};

	useEffect(() => {
		setEmail(buildEmailFromUsername(username, emailDomain));
	}, [username, emailDomain]);

	const onClearForm = () => {
		setFullName('');
		setPronouns('');
		setUsername('');
		setEmail(buildEmailFromUsername('', emailDomain));
		setDefaultEmailAccount('');
		setDefaultEmailAccountPassword('');
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
			<h2>Create new account</h2>
			<form onSubmit={onSubmit} style={styles.form} autoComplete="off">
				<label style={styles.fieldLabel} htmlFor="hufak-full-name">
					full name
				</label>
				<input
					id="hufak-full-name"
					type="text"
					value={fullName}
					onChange={onFullNameChange}
					autoComplete="off"
					name="hufak-create-full-name"
					disabled={isCreating}
					placeholder="John Doe"
					style={{ ...styles.input, ...styles.addUserInput }}
				/>
				{fullName.length > 0 && !isFullNameValid && (
					<p style={styles.validationMessage}>
						Use two or more words. Each word must start with a capital letter and
						contain letters only.
					</p>
				)}

				<label style={styles.fieldLabel} htmlFor="hufak-pronouns">
					pronouns
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
						placeholder="she/her"
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
					username
				</label>
				<input
					id="hufak-username"
					type="text"
					value={username}
					onChange={onUsernameChange}
					autoComplete="off"
					name="hufak-create-username"
					disabled={isCreating}
					style={{ ...styles.input, ...styles.addUserInput }}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-email">
					account email
				</label>
				<input
					id="hufak-email"
					type="email"
					value={email}
					onChange={onEmailChange}
					autoComplete="off"
					name="hufak-create-email"
					disabled={isCreating}
					style={{ ...styles.input, ...styles.addUserInput }}
				/>
				<p style={styles.hintText}>Default domain from configuration: {emailDomain}</p>

				<label style={styles.fieldLabel} htmlFor="hufak-default-email-account">
					Primary mailbox (copy password over from{' '}
					<a
						href="https://kas.all-inkl.com/email/email-account/"
						target="_blank"
						rel="noreferrer"
						style={styles.inlineLink}
					>
						kas.all-inkl.com
					</a>
					)
				</label>
				<div style={styles.mailboxRow}>
					<input
						id="hufak-default-email-account"
						type="email"
						value={defaultEmailAccount}
						onChange={onDefaultEmailAccountChange}
						autoComplete="off"
						name="hufak-create-mailbox-email"
						disabled={isCreating}
						placeholder="e.g. bipol@hufak.net (optional)"
						style={{ ...styles.input, ...styles.addUserInput, maxWidth: 'none', minWidth: 0 }}
					/>
					<input
						id="hufak-default-email-account-password"
						type="password"
						value={defaultEmailAccountPassword}
						onChange={onDefaultEmailAccountPasswordChange}
						autoComplete="new-password"
						name="hufak-create-mailbox-password"
						disabled={isCreating}
						placeholder="Password"
						style={{ ...styles.input, ...styles.addUserInput, maxWidth: 'none', minWidth: 0 }}
					/>
				</div>

				<div style={styles.buttonRow}>
					<button
						type="submit"
						disabled={!isFullNameValid || isCreating || isCreateLocked}
						style={styles.submitButton}
					>
						{isCreating ? 'Creating...' : 'create'}
					</button>
					<button
						type="button"
						onClick={onClearForm}
						disabled={isCreating}
						style={styles.clearButton}
					>
						clear
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
