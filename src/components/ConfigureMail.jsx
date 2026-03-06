import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { UserEmailAccountsOverview } from './UserEmailAccountsOverview';
import { styles } from '../styles';

function ConfigureMail({ preselectedUid }) {
	const [selectedUid, setSelectedUid] = useState(preselectedUid || '');
	const [configureMailUser, setConfigureMailUser] = useState(null);
	const [loadingUser, setLoadingUser] = useState(false);
	const [userLookupError, setUserLookupError] = useState('');
	const [editingPrimaryAccount, setEditingPrimaryAccount] = useState(null);
	const [editingEmail, setEditingEmail] = useState('');
	const [editingPassword, setEditingPassword] = useState('');
	const [editingSubmitting, setEditingSubmitting] = useState(false);
	const [editingStatus, setEditingStatus] = useState('');

	const loadMailboxOverview = useCallback(async (uidToLoad) => {
		if (!uidToLoad) {
			setConfigureMailUser(null);
			setUserLookupError('');
			setLoadingUser(false);
			return;
		}

		setLoadingUser(true);
		setUserLookupError('');
		try {
			const data = await apiRequest(OC.generateUrl('/apps/hufak/api/users/status'));
			const nextUsers = Array.isArray(data.users) ? data.users : [];
			const matchingUser = nextUsers.find(
				(user) => String(user.uid || '') === String(uidToLoad),
			);
			setConfigureMailUser(matchingUser || null);
			if (!matchingUser) {
				setUserLookupError(`No mailbox overview found for uid "${uidToLoad}".`);
			}
		} catch (err) {
			setUserLookupError(err instanceof Error ? err.message : 'Failed to load mailbox overview');
			setConfigureMailUser(null);
		} finally {
			setLoadingUser(false);
		}
	}, []);

	useEffect(() => {
		setSelectedUid(preselectedUid || '');
	}, [preselectedUid]);

	useEffect(() => {
		loadMailboxOverview(selectedUid);
	}, [selectedUid, loadMailboxOverview]);

	const resolvedUid = configureMailUser?.uid || '';
	const resolvedDisplayName =
		configureMailUser?.displayName ||
		configureMailUser?.name ||
		configureMailUser?.fullName ||
		'';
	const resolvedPronouns = configureMailUser?.pronouns || configureMailUser?.pronoun || '';
	const displayNameAndPronouns = [resolvedDisplayName, resolvedPronouns]
		.filter((value) => value && value.trim() !== '')
		.map((value) => value.trim())
		.join(', ');
	const userSummary = resolvedUid
		? `${resolvedUid}${displayNameAndPronouns ? ` (${displayNameAndPronouns})` : ''}`
		: selectedUid
			? loadingUser
				? 'Loading user...'
				: `No user found for "${selectedUid}"`
			: 'No user selected';

	const openPrimaryEmailEditor = (event) => {
		const payload = event;
		if (!payload || payload.type !== 'primaryEmail') {
			return;
		}

		setEditingPrimaryAccount({
			uid: payload.uid,
			email: payload.email || '',
		});
		setEditingEmail(payload.email || '');
		setEditingPassword('');
		setEditingStatus('');
	};

	const closePrimaryEmailEditor = () => {
		setEditingPrimaryAccount(null);
		setEditingEmail('');
		setEditingPassword('');
		setEditingStatus('');
		setEditingSubmitting(false);
	};

	const submitPrimaryAccountSettings = async (event) => {
		event.preventDefault();
		if (!editingPrimaryAccount?.uid || !editingEmail || !editingPassword) {
			setEditingStatus('Please provide e-mail and password.');
			return;
		}

		setEditingSubmitting(true);
		setEditingStatus('Setting primary e-mail account...');
		try {
			const body = new URLSearchParams({
				uid: editingPrimaryAccount.uid,
				email: editingEmail,
				password: editingPassword,
			});
			const data = await apiRequest(OC.generateUrl('/apps/hufak/api/snappymail/settings'), {
				method: 'POST',
				headers: {
					'content-type':
						'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			});
			const output = String(data.output || '').trim();
			const errorOutput = String(data.errorOutput || '').trim();
			const exitCode = data.exitCode ?? '';
			const lines = [`Exit code: ${exitCode}`];
			if (output) {
				lines.push(`Output: ${output}`);
			}
			if (errorOutput) {
				lines.push(`Error output: ${errorOutput}`);
			}
			if (!output && !errorOutput) {
				lines.push('Command completed with no output.');
			}
			setEditingStatus(lines.join('\n'));
			await loadMailboxOverview(selectedUid);
		} catch (err) {
			setEditingStatus(
				`Failed to set primary e-mail account: ${err instanceof Error ? err.message : 'Unknown error'}`,
			);
		} finally {
			setEditingSubmitting(false);
		}
	};

	const updateIdentitySignature = (identityPayload) => {
		if (!identityPayload || !configureMailUser) {
			return;
		}

		setConfigureMailUser((current) => {
			if (!current) {
				return current;
			}

			const next = { ...current };

			const updateIdentityCollection = (collection) => {
				if (!Array.isArray(collection) && typeof collection !== 'object') {
					return collection;
				}

				const index = Number.isInteger(identityPayload.index)
					? identityPayload.index
					: Number.parseInt(identityPayload.index, 10);
				if (!Number.isInteger(index) || index < 0) {
					return collection;
				}

				if (Array.isArray(collection)) {
					if (index >= collection.length) {
						return collection;
					}
					const clone = [...collection];
					const item = clone[index];
					if (item && typeof item === 'object') {
						clone[index] = {
							...item,
							signature: identityPayload.signature,
						};
					}
					return clone;
				}

				const keys = Object.keys(collection);
				if (index >= keys.length) {
					return collection;
				}
				const key = keys[index];
				const item = collection[key];
				if (!item || typeof item !== 'object') {
					return collection;
				}
				return {
					...collection,
					[key]: {
						...item,
						signature: identityPayload.signature,
					},
				};
			};

			if (identityPayload.accountType === 'primary') {
				next.identities = updateIdentityCollection(current.identities);
			} else if (identityPayload.accountKey) {
				const currentAdditionalIdentities = {
					...(current.additionalAccountIdentities || {}),
				};
				currentAdditionalIdentities[identityPayload.accountKey] = updateIdentityCollection(
					currentAdditionalIdentities[identityPayload.accountKey],
				);
				next.additionalAccountIdentities = currentAdditionalIdentities;
			}

			return next;
		});
	};

	return (
		<section style={styles.formSection}>
			<h2>User mailboxes</h2>
			<div style={styles.form}>
				<label style={styles.fieldLabel}>user</label>
				<span style={styles.userSummaryText}>{userSummary}</span>

				<h3 style={styles.subheading}>Mail account overview</h3>
				{loadingUser ? (
					<p>Loading account overview...</p>
				) : userLookupError ? (
					<p style={styles.validationMessage}>{userLookupError}</p>
				) : (
					<UserEmailAccountsOverview
						user={configureMailUser}
						editable
						onSetIdentitySignature={updateIdentitySignature}
						onEditEntry={openPrimaryEmailEditor}
					/>
				)}
			</div>
			{editingPrimaryAccount && (
				<div style={styles.modalBackdrop} onMouseDown={closePrimaryEmailEditor} role="presentation">
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>Edit primary e-mail account</h4>
						<form onSubmit={submitPrimaryAccountSettings} style={styles.form} autoComplete="off">
							<label style={styles.fieldLabel} htmlFor="hufak-mailbox-email">
								e-mail
							</label>
							<input
								id="hufak-mailbox-email"
								type="email"
								value={editingEmail}
								onChange={(event) => setEditingEmail(event.target.value)}
								name="hufak-set-mailbox-email"
								autoComplete="off"
								disabled={editingSubmitting}
								style={styles.input}
							/>
							<label style={styles.fieldLabel} htmlFor="hufak-mailbox-password">
								password
							</label>
							<input
								id="hufak-mailbox-password"
								type="password"
								value={editingPassword}
								onChange={(event) => setEditingPassword(event.target.value)}
								name="hufak-set-mailbox-password"
								autoComplete="new-password"
								disabled={editingSubmitting}
								style={styles.input}
							/>
							<div style={styles.modalButtonRow}>
								<button
									type="submit"
									disabled={editingSubmitting || !editingEmail || !editingPassword}
									style={styles.submitButton}
								>
									{editingSubmitting ? 'Setting...' : 'set'}
								</button>
								<button
									type="button"
									onClick={closePrimaryEmailEditor}
									style={styles.clearButton}
								>
									cancel
								</button>
							</div>
							<textarea
								readOnly
								value={editingStatus}
								name="hufak-set-mailbox-output"
								autoComplete="off"
								style={styles.outputBox}
								placeholder="Status output will appear here."
							/>
						</form>
					</div>
				</div>
			)}
		</section>
	);
}

export { ConfigureMail };
