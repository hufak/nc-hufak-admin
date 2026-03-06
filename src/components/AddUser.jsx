import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { buildEmailFromUsername, fullNameIsValid, usernameFromFullName } from '../utils/userUtils';
import { styles } from '../styles';

function AddUser({ emailDomain }) {
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

	const onFullNameChange = (event) => {
		const nextFullName = event.target.value;
		setFullName(nextFullName);
		setIsCreateLocked(false);
		setUsername(usernameFromFullName(nextFullName));
	};

	const onPronounsChange = (event) => {
		setPronouns(event.target.value);
		setIsCreateLocked(false);
	};

	const setPronounsQuickFill = (nextPronouns) => {
		setPronouns(nextPronouns);
		setIsCreateLocked(false);
	};

	const onUsernameChange = (event) => {
		setUsername(event.target.value);
		setIsCreateLocked(false);
	};

	const onEmailChange = (event) => {
		setEmail(event.target.value);
		setIsCreateLocked(false);
	};

	const onDefaultEmailAccountChange = (event) => {
		setDefaultEmailAccount(event.target.value);
		setIsCreateLocked(false);
	};

	const onDefaultEmailAccountPasswordChange = (event) => {
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

	const onSubmit = async (event) => {
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
		setCreationOutput(`⏳ Step 1/${totalSteps}: Creating user...`);

		try {
			const body = new URLSearchParams({
				fullName,
				pronoun: pronouns,
				username,
				email,
			});
			const data = await apiRequest(OC.generateUrl('/apps/hufak/api/users'), {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			});
			const actualCreatedUid = String(data.username || createdUid);
			const lines = [
				`✅ Step 1/${totalSteps}: ${data.message || `User "${actualCreatedUid}" created successfully`}`,
			];
			if (data.password) {
				lines.push(`🔐 Generated password: ${data.password}`);
			}

			lines.push(`⏳ Step 2/${totalSteps}: Setting app order defaults...`);
			try {
				const resetData = await apiRequest(
					OC.generateUrl(
						`/apps/hufak/api/users/${encodeURIComponent(actualCreatedUid)}/apporder/default`,
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
				lines.push(`⏳ Step 3/${totalSteps}: Setting primary user mailbox...`);
				try {
					const mailboxBody = new URLSearchParams({
						uid: actualCreatedUid,
						email: defaultEmailAccount.trim(),
						password: defaultEmailAccountPassword,
					});
					const mailboxData = await apiRequest(
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
						`✅ Step 3/${totalSteps}: Primary user mailbox configured. ${messageParts.join(' | ')}`,
					);
				} catch (step3Err) {
					allStepsSucceeded = false;
					lines.push(
						`❌ Step 3/${totalSteps}: Failed to set primary user mailbox: ${
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
				`❌ Step 1/${totalSteps} failed: ${err instanceof Error ? err.message : 'User creation failed'}`,
			);
			setIsCreateLocked(false);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>Create new user</h2>
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
					style={styles.input}
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
						style={styles.input}
					/>
					<button
						type="button"
						onClick={() => setPronounsQuickFill('sie/sie she/her')}
						disabled={isCreating}
						style={styles.quickFillButton}
					>
						she/her
					</button>
					<button
						type="button"
						onClick={() => setPronounsQuickFill('er/ihn he/him')}
						disabled={isCreating}
						style={styles.quickFillButton}
					>
						he/him
					</button>
					<button
						type="button"
						onClick={() => setPronounsQuickFill('they/them')}
						disabled={isCreating}
						style={styles.quickFillButton}
					>
						they/them
					</button>
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
					style={styles.input}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-email">
					user email
				</label>
				<input
					id="hufak-email"
					type="email"
					value={email}
					onChange={onEmailChange}
					autoComplete="off"
					name="hufak-create-email"
					disabled={isCreating}
					style={styles.input}
				/>
				<p style={styles.hintText}>Default domain from configuration: {emailDomain}</p>

				<label style={styles.fieldLabel} htmlFor="hufak-default-email-account">
					primary user mailbox
				</label>
				<input
					id="hufak-default-email-account"
					type="email"
					value={defaultEmailAccount}
					onChange={onDefaultEmailAccountChange}
					autoComplete="off"
					name="hufak-create-mailbox-email"
					disabled={isCreating}
					placeholder="e.g. bipol@hufak.net (optional)"
					style={styles.input}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-default-email-account-password">
					primary user mailbox password
				</label>
				<input
					id="hufak-default-email-account-password"
					type="password"
					value={defaultEmailAccountPassword}
					onChange={onDefaultEmailAccountPasswordChange}
					autoComplete="new-password"
					name="hufak-create-mailbox-password"
					disabled={isCreating}
					placeholder="copy over from https://kas.all-inkl.com"
					style={styles.input}
				/>

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

export { AddUser };
