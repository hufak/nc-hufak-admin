import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { SECTION_KEYS, updateUrlSection } from '../constants';
import { AccountEmailAccountsOverview } from './AccountEmailAccountsOverview';
import { AccountCredentialsForm, AccountCredentialsModal } from './AccountCredentialsModal';
import { styles } from '../styles';
import type {
	DeleteEntryPayload,
	EmailDomainResponse,
	EditAccountPayload,
	IdentityEntry,
	MailboxUser,
	SetIdentitySignaturePayload,
	SharedMailboxesResponse,
	SnappyMailSettingsResponse,
	UserStatusResponse,
} from '../types';

interface ConfigureMailProps {
	preselectedUid?: string
}

type AccountCredentialsEditorState = {
	uid: string
	email: string
} | null

type AdditionalAccountEditorState = {
	uid: string
	primaryEmail: string
} | null

function ConfigureMail({ preselectedUid }: ConfigureMailProps): ReactElement {
	const [selectedUid, setSelectedUid] = useState(preselectedUid || '');
	const [configureMailUser, setConfigureMailUser] = useState<MailboxUser | null>(null);
	const [loadingUser, setLoadingUser] = useState(false);
	const [userLookupError, setUserLookupError] = useState('');
	const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
	const [sharedPrimaryAccountUserUids, setSharedPrimaryAccountUserUids] = useState<string[]>([]);
	const [editingAccountCredentials, setEditingAccountCredentials] = useState<AccountCredentialsEditorState>(null);
	const [addingAdditionalAccount, setAddingAdditionalAccount] = useState<AdditionalAccountEditorState>(null);
	const [editingEmail, setEditingEmail] = useState('');
	const [editingPassword, setEditingPassword] = useState('');
	const [editingSubmitting, setEditingSubmitting] = useState(false);
	const [editingStatus, setEditingStatus] = useState('');
	const [setupResultModal, setSetupResultModal] = useState<{ title: string; message: string } | null>(null);
	const navigateBackToAccountOverview = () => {
		updateUrlSection(SECTION_KEYS.ACCOUNT_OVERVIEW);
		window.dispatchEvent(new PopStateEvent('popstate'));
	};

	const loadMailboxOverview = useCallback(async (uidToLoad: string) => {
		if (!uidToLoad) {
			setConfigureMailUser(null);
			setSharedPrimaryAccountUserUids([]);
			setUserLookupError('');
			setLoadingUser(false);
			return;
		}

		setLoadingUser(true);
		setUserLookupError('');
		try {
			const [selectedData, allUsersData] = await Promise.all([
				apiRequest<UserStatusResponse>(
					`${OC.generateUrl('/apps/hufak/api/accounts/status')}?uid=${encodeURIComponent(uidToLoad)}&includePronoun=1`,
				),
				apiRequest<UserStatusResponse>(
					OC.generateUrl('/apps/hufak/api/accounts/status'),
				),
			]);
			const nextUsers = Array.isArray(selectedData.users) ? selectedData.users : [];
			const matchingUser = nextUsers.find(
				(user) => String(user.uid || '') === String(uidToLoad),
			);
			setConfigureMailUser(matchingUser || null);
			if (!matchingUser) {
				setSharedPrimaryAccountUserUids([]);
				setUserLookupError(`No mailbox overview found for account "${uidToLoad}".`);
			} else {
				const allUsers = Array.isArray(allUsersData.users) ? allUsersData.users : [];
				const sharedUsers = allUsers
					.filter((user) =>
						String(user.uid || '') !== String(uidToLoad)
						&& String(user.primaryEmail || '').trim() !== ''
						&& String(user.primaryEmail || '').trim() === String(matchingUser.primaryEmail || '').trim(),
					)
					.map((user) => String(user.uid || '').trim())
					.filter((uid) => uid !== '');
				setSharedPrimaryAccountUserUids(sharedUsers);
			}
		} catch (err) {
			setUserLookupError(err instanceof Error ? err.message : 'Failed to load mailbox overview');
			setConfigureMailUser(null);
			setSharedPrimaryAccountUserUids([]);
		} finally {
			setLoadingUser(false);
		}
	}, []);

	useEffect(() => {
		setSelectedUid(preselectedUid || '');
	}, [preselectedUid]);

	useEffect(() => {
		async function loadEmailSuggestions() {
			try {
				const [domainData, sharedMailboxesData] = await Promise.all([
					apiRequest<EmailDomainResponse>(
						OC.generateUrl('/apps/hufak/api/settings/email-domain'),
					),
					apiRequest<SharedMailboxesResponse>(
						OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
					),
				]);
				const emailDomain = String(domainData.emailDomain || '').trim();
				const sharedMailboxes = sharedMailboxesData.sharedMailboxes;
				if (!emailDomain || !sharedMailboxes || typeof sharedMailboxes !== 'object') {
					setEmailSuggestions([]);
					return;
				}
				const nextSuggestions = Object.keys(sharedMailboxes)
					.map((prefix) => String(prefix || '').trim())
					.filter((prefix) => prefix !== '')
					.sort((left, right) => left.localeCompare(right))
					.map((prefix) => `${prefix}@${emailDomain}`);
				setEmailSuggestions(Array.from(new Set(nextSuggestions)));
			} catch {
				setEmailSuggestions([]);
			}
		}

		void loadEmailSuggestions();
	}, []);

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
				? 'Loading account...'
				: `No account found for "${selectedUid}"`
			: 'No account selected';
	const hasConfiguredEmailAccounts = Boolean(
		configureMailUser?.primaryEmail?.trim()
		|| (Array.isArray(configureMailUser?.additionalAccounts)
			? configureMailUser?.additionalAccounts.length
			: Object.keys(configureMailUser?.additionalAccounts || {}).length),
	);

	useEffect(() => {
		if (!hasConfiguredEmailAccounts && configureMailUser) {
			setEditingAccountCredentials({
				uid: configureMailUser.uid,
				email: '',
			});
			setEditingEmail('');
			setEditingPassword('');
			setEditingStatus('');
			setEditingSubmitting(false);
		}
	}, [configureMailUser, hasConfiguredEmailAccounts]);

	const openAccountCredentialsEditor = (payload: EditAccountPayload) => {
		if (!payload || payload.type !== 'primaryEmail') {
			return;
		}
		if (!hasConfiguredEmailAccounts) {
			return;
		}

		const currentPrimaryEmail = String(configureMailUser?.primaryEmail || '').trim();
		const initialEmail = currentPrimaryEmail || String(payload.email || '').trim();

		setEditingAccountCredentials({
			uid: payload.uid,
			email: initialEmail,
		});
		setEditingEmail(initialEmail);
		setEditingPassword('');
		setEditingStatus('');
	};

	const closeAccountCredentialsEditor = () => {
		setEditingAccountCredentials(null);
		setEditingEmail('');
		setEditingPassword('');
		setEditingStatus('');
		setEditingSubmitting(false);
	};

	const openAdditionalAccountEditor = (uid: string) => {
		const primaryEmail = String(configureMailUser?.primaryEmail || '').trim();
		if (!uid || !primaryEmail) {
			setSetupResultModal({
				title: 'Add additional account failed',
				message: 'A primary account must be configured before adding additional accounts.',
			});
			return;
		}
		setAddingAdditionalAccount({
			uid,
			primaryEmail,
		});
		setEditingEmail('');
		setEditingPassword('');
		setEditingStatus('');
		setEditingSubmitting(false);
	};

	const closeAdditionalAccountEditor = () => {
		setAddingAdditionalAccount(null);
		setEditingEmail('');
		setEditingPassword('');
		setEditingStatus('');
		setEditingSubmitting(false);
	};
	const formatSnappyMailSettingsStatus = (data: SnappyMailSettingsResponse): string => {
		const output = String(data.output || '').trim();
		const errorOutput = String(data.errorOutput || '').trim();
		const identitiesFileMessage = String(data.identitiesFileMessage || '').trim();
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
		if (identitiesFileMessage) {
			lines.push(`Identity file: ${identitiesFileMessage}`);
		}
		return lines.join('\n');
	};
	const applyPrimaryMailboxSettings = async ({
		uid,
		email,
		password = '',
	}: {
		uid: string
		email: string
		password?: string
	}): Promise<string> => {
		const body = new URLSearchParams({
			uid,
			email,
		});
		if (password !== '') {
			body.set('password', password);
		}
		const data = await apiRequest<SnappyMailSettingsResponse>(
			OC.generateUrl('/apps/hufak/api/snappymail/settings'),
			{
				method: 'POST',
				headers: {
					'content-type':
						'application/x-www-form-urlencoded;charset=UTF-8',
				},
				body,
			},
		);
		await loadMailboxOverview(uid || selectedUid);
		return formatSnappyMailSettingsStatus(data);
	};

	const submitPrimaryAccountSettingsForUid = async (uid: string) => {
		const isInlineInitialSetup = !hasConfiguredEmailAccounts;
		if (!uid || !editingEmail || !editingPassword) {
			if (isInlineInitialSetup) {
				setSetupResultModal({
					title: 'Set primary e-mail account failed',
					message: 'Please provide e-mail and password.',
				});
			} else {
				setEditingStatus('Please provide e-mail and password.');
			}
			return;
		}

		setEditingSubmitting(true);
		try {
			const statusMessage = await applyPrimaryMailboxSettings({
				uid,
				email: editingEmail,
				password: editingPassword,
			});
			if (isInlineInitialSetup) {
				setEditingAccountCredentials(null);
				setEditingStatus('');
				setSetupResultModal({
					title: 'Primary e-mail account set',
					message: statusMessage,
				});
			} else {
				closeAccountCredentialsEditor();
				setSetupResultModal({
					title: 'Primary e-mail account updated',
					message: statusMessage,
				});
			}
		} catch (err) {
			const message = `Failed to set primary e-mail account: ${err instanceof Error ? err.message : 'Unknown error'}`;
			if (isInlineInitialSetup) {
				setSetupResultModal({
					title: 'Set primary e-mail account failed',
					message,
				});
			} else {
				closeAccountCredentialsEditor();
				setSetupResultModal({
					title: 'Update primary e-mail account failed',
					message,
				});
			}
		} finally {
			setEditingSubmitting(false);
		}
	};

	const submitPrimaryAccountSettings = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await submitPrimaryAccountSettingsForUid(editingAccountCredentials?.uid || '');
	};

	const submitAdditionalAccountSettings = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const uid = addingAdditionalAccount?.uid || '';
		if (!uid || !editingEmail || !editingPassword) {
			setSetupResultModal({
				title: 'Add additional account failed',
				message: 'Please provide e-mail and password.',
			});
			return;
		}

		setEditingSubmitting(true);
		try {
			const body = new URLSearchParams({
				uid,
				email: editingEmail.trim(),
				password: editingPassword,
			});
			const response = await apiRequest<{ message?: string }>(
				OC.generateUrl('/apps/hufak/api/snappymail/additional-account'),
				{
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			await loadMailboxOverview(uid);
			closeAdditionalAccountEditor();
			setSetupResultModal({
				title: 'Additional account added',
				message: response.message || 'Additional account added.',
			});
		} catch (err) {
			closeAdditionalAccountEditor();
			setSetupResultModal({
				title: 'Add additional account failed',
				message: err instanceof Error ? err.message : 'Failed to add additional account',
			});
		} finally {
			setEditingSubmitting(false);
		}
	};

	const updateIdentitySignature = (identityPayload: SetIdentitySignaturePayload) => {
		if (!identityPayload || !configureMailUser) {
			return;
		}

		setConfigureMailUser((current) => {
			if (!current) {
				return current;
			}

			const next = { ...current };

			const updateIdentityCollection = (
				collection: IdentityEntry[] | Record<string, IdentityEntry> | null | undefined,
			): IdentityEntry[] | Record<string, IdentityEntry> | null | undefined => {
				if (!Array.isArray(collection) && typeof collection !== 'object') {
					return collection;
				}

				const index = identityPayload.index;
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
							Name: identityPayload.displayName,
							signature: identityPayload.signature,
						} as IdentityEntry;
					}
					return clone;
				}

				const keys = Object.keys(collection as Record<string, IdentityEntry>);
				if (index >= keys.length) {
					return collection;
				}
				const key = keys[index];
				const item = (collection as Record<string, IdentityEntry>)[key];
				if (!item || typeof item !== 'object') {
					return collection;
				}
				return {
					...collection,
					[key]: {
						...item,
						Name: identityPayload.displayName,
						signature: identityPayload.signature,
					} as IdentityEntry,
				};
			};

			if (identityPayload.accountType === 'primary') {
				next.identities = updateIdentityCollection(current.identities);
			} else if (identityPayload.accountKey) {
				const currentAdditionalIdentities = {
					...(current.additionalAccountIdentities || {}),
				};
				const updatedCollection = updateIdentityCollection(
					currentAdditionalIdentities[identityPayload.accountKey],
				);
				if (updatedCollection) {
					currentAdditionalIdentities[identityPayload.accountKey] = updatedCollection;
				}
				next.additionalAccountIdentities = currentAdditionalIdentities;
			}

			return next;
		});
	};
	const deleteMailboxEntry = async (payload: DeleteEntryPayload): Promise<string> => {
		if (!payload) {
			return 'No delete target provided.';
		}

		if (payload.type === 'primaryEmail') {
			try {
				const body = new URLSearchParams({
					uid: payload.uid || selectedUid,
				});
				const response = await apiRequest<{ message?: string }>(
					OC.generateUrl('/apps/hufak/api/snappymail/settings'),
					{
						method: 'DELETE',
						headers: {
							'content-type':
								'application/x-www-form-urlencoded;charset=UTF-8',
						},
						body,
					},
				);
				await loadMailboxOverview(payload.uid || selectedUid);
				return response.message || 'Primary e-mail account removed.';
			} catch (err) {
				throw new Error(
					err instanceof Error
						? err.message
						: 'Failed to delete primary e-mail account',
				);
			}
		}

		if (payload.type === 'additionalEmail') {
			try {
				const body = new URLSearchParams({
					uid: payload.uid || selectedUid,
					email: payload.email || '',
				});
				const response = await apiRequest<{ message?: string }>(
					OC.generateUrl('/apps/hufak/api/snappymail/additional-account'),
					{
						method: 'DELETE',
						headers: {
							'content-type':
								'application/x-www-form-urlencoded;charset=UTF-8',
						},
						body,
					},
				);
				await loadMailboxOverview(payload.uid || selectedUid);
				return response.message || 'Additional account deleted.';
			} catch (err) {
				throw new Error(
					err instanceof Error
						? err.message
						: 'Failed to delete additional e-mail account',
				);
			}
		}

		if (payload.type === 'identity') {
			return 'Deleting identities is not implemented yet.';
		}

		return 'No delete action was performed.';
	};

	return (
		<section style={styles.formSection}>
			<div style={{ ...styles.buttonRow, marginBottom: '6px', alignItems: 'center', width: '100%' }}>
				<button
					type="button"
					onClick={navigateBackToAccountOverview}
					style={styles.clearButton}
					aria-label="Back to account overview"
					title="Back to account overview"
				>
					<svg
						viewBox="0 0 24 24"
						aria-hidden="true"
						style={styles.squareIcon}
					>
						<path
							fill="currentColor"
							d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z"
						/>
					</svg>
				</button>
				<h2 style={{ margin: 0 }}>
					{resolvedUid ? (
						<>
							Snappymail accounts for user <code style={styles.monospaceCode}>{resolvedUid}</code>
						</>
					) : 'Snappymail accounts'}
				</h2>
			</div>
			<div style={styles.form}>
				<div style={styles.proseContent}>
					<p style={styles.introText}>
						In Snappymail, every Nextcloud user has exactly one primary e-mail account
						associated with it. Additional e-mail accounts are not tied to the
						Nextcloud user, but to the primary e-mail account! This means that when
						you add an additional personal e-mail account to a shared account (such
						as bipol), all users with bipol as their primary account will be able to
						access the additional personal account. When a user is given a personal
						e-mail account, it is therefore important to set their personal account
						as their primary account, and add shared mailboxes as additional accounts
						underneath.
					</p>
				</div>
				{loadingUser ? (
					<p>Loading account overview...</p>
				) : userLookupError ? (
					<p style={styles.validationMessage}>{userLookupError}</p>
				) : (
					<AccountEmailAccountsOverview
						user={configureMailUser}
						editable
						onDeleteEntry={deleteMailboxEntry}
						onSetIdentitySignature={updateIdentitySignature}
						onEditAccount={openAccountCredentialsEditor}
						onAddAdditionalAccount={openAdditionalAccountEditor}
						sharedPrimaryAccountUserUids={sharedPrimaryAccountUserUids}
						emptyEditableState={configureMailUser ? (
							<div style={styles.form}>
								<p style={styles.modalText}>
									This Nextcloud user has no primary Snappymail email account associated with it yet.
									You can set one here:
								</p>
								<AccountCredentialsForm
									title="Set account"
									email={editingEmail}
									password={editingPassword}
									submitting={editingSubmitting}
									status=""
									showStatus={false}
									submitLabel="Set"
									emailInputId="hufak-inline-mailbox-email"
									passwordInputId="hufak-inline-mailbox-password"
									onEmailChange={setEditingEmail}
									onPasswordChange={setEditingPassword}
									emailSuggestions={emailSuggestions}
									onSubmit={(event) => {
										event.preventDefault();
										void submitPrimaryAccountSettingsForUid(configureMailUser.uid);
									}}
								/>
							</div>
						) : null}
					/>
				)}
			</div>
			{editingAccountCredentials && hasConfiguredEmailAccounts && (
					<AccountCredentialsModal
						title="Edit primary account"
					email={editingEmail}
					password={editingPassword}
					submitting={editingSubmitting}
					status={editingStatus}
					showStatus={false}
						submitLabel="Save"
					emailInputId="hufak-mailbox-email"
					passwordInputId="hufak-mailbox-password"
					onEmailChange={setEditingEmail}
					onPasswordChange={setEditingPassword}
					emailSuggestions={emailSuggestions}
					onSubmit={submitPrimaryAccountSettings}
					onCancel={closeAccountCredentialsEditor}
					onClose={closeAccountCredentialsEditor}
				/>
			)}
			{addingAdditionalAccount && (
				<AccountCredentialsModal
					title="Add additional account"
					note={`This user already has ${addingAdditionalAccount.primaryEmail} set as its primary account. Beware that any additional accounts you set here will be associated with the primary email account, so any other Nextcloud user who shares the same primary account will also get access to the additional accounts.`}
					label="Additional mailbox"
					email={editingEmail}
					password={editingPassword}
					submitting={editingSubmitting}
					status={editingStatus}
					showStatus={false}
					submitLabel="Add"
					emailInputId="hufak-additional-account-email"
					passwordInputId="hufak-additional-account-password"
					onEmailChange={setEditingEmail}
					onPasswordChange={setEditingPassword}
					emailSuggestions={emailSuggestions}
					onSubmit={submitAdditionalAccountSettings}
					onCancel={closeAdditionalAccountEditor}
					cancelLabel="Cancel"
					onClose={closeAdditionalAccountEditor}
				/>
			)}
			{setupResultModal && (
				<div style={styles.modalBackdrop} onMouseDown={() => setSetupResultModal(null)} role="presentation">
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>{setupResultModal.title}</h4>
						<textarea
							readOnly
							value={setupResultModal.message}
							autoComplete="off"
							style={styles.outputBox}
						/>
						<div style={styles.modalButtonRow}>
								<button
									type="button"
									onClick={() => setSetupResultModal(null)}
									style={styles.clearButton}
								>
									Close
								</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}

export { ConfigureMail };
