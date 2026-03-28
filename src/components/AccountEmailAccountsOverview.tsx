import { useState } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { apiRequest } from '../api';
import { extractAdditionalAccountEmails, extractIdentityEntries } from '../utils/accountUtils';
import {
	serializeSignatureMarkup,
	splitSignatureMarkup,
} from '../utils/signatureUtils';
import { styles } from '../styles';
import { SignatureMarkupEditor } from './SignatureMarkupEditor';
import { SignaturePreview } from './SignaturePreview';
import type {
	DeleteEntryPayload,
	EditAccountPayload,
	IdentityEntry,
	MailboxUser,
	NormalizedIdentityEntry,
	SetIdentitySignaturePayload,
	SharedMailboxesResponse,
	SignatureTemplateResponse,
} from '../types';

interface IdentityEditorModalState {
	prefix: string
	index: number
	identityId: string
	entry: IdentityEntry | NormalizedIdentityEntry
	uid: string
	accountKey?: string
	accountType?: 'primary'
	key: string
	displayName: string
	signature: string
	accountEmail: string
}

interface TemplateSignatureModalState {
	prefix: string
	index: number
	entry: NormalizedIdentityEntry
	uid: string
	accountKey?: string
	accountType?: 'primary'
	key: string
	accountEmail: string
}

interface AccountEmailAccountsOverviewProps {
	user: MailboxUser | null
	editable?: boolean
	onDeleteEntry?: (payload: DeleteEntryPayload) => Promise<string>
	onSetIdentitySignature?: (payload: SetIdentitySignaturePayload) => void
	onEditAccount?: (payload: EditAccountPayload) => void
	onAddAdditionalAccount?: (uid: string) => void
	emptyEditableState?: ReactNode
	sharedPrimaryAccountUserUids?: string[]
}

function getIdentityLabel(entry?: IdentityEntry | NormalizedIdentityEntry): string {
	if (!entry) {
		return 'this identity';
	}
	if ('name' in entry && typeof entry.name === 'string' && entry.name.trim() !== '') {
		return entry.name;
	}
	if ('Name' in entry && typeof entry.Name === 'string' && entry.Name.trim() !== '') {
		return entry.Name;
	}
	if ('email' in entry && typeof entry.email === 'string' && entry.email.trim() !== '') {
		return entry.email;
	}
	if ('Email' in entry && typeof entry.Email === 'string' && entry.Email.trim() !== '') {
		return entry.Email;
	}
	return 'this identity';
}

function findDepartmentNames(
	sharedMailboxes: Record<string, unknown>,
	accountKey: string,
): { de: string; en: string } | null {
	const directMatch = sharedMailboxes[accountKey];
	if (
		directMatch &&
		typeof directMatch === 'object' &&
		!Array.isArray(directMatch)
	) {
		const de = typeof (directMatch as Record<string, unknown>).de === 'string'
			? String((directMatch as Record<string, unknown>).de).trim()
			: '';
		const en = typeof (directMatch as Record<string, unknown>).en === 'string'
			? String((directMatch as Record<string, unknown>).en).trim()
			: '';
		if (de || en) {
			return { de, en };
		}
	}

	for (const value of Object.values(sharedMailboxes)) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		const nestedMatch = findDepartmentNames(value as Record<string, unknown>, accountKey);
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return null;
}

function buildSignatureFromTemplate(
	template: string,
	user: MailboxUser,
	accountEmail: string,
	sharedMailboxes: Record<string, unknown>,
): string {
	const displayName =
		user.accountName?.trim() ||
		user.displayName?.trim() ||
		user.name?.trim() ||
		user.fullName?.trim() ||
		user.uid.trim();
	const pronouns = user.pronouns?.trim() || user.pronoun?.trim() || '';
	const accountKey = accountEmail.includes('@')
		? accountEmail.split('@', 1)[0].trim().toLowerCase()
		: '';
	const departmentNames = accountKey !== ''
		? findDepartmentNames(sharedMailboxes, accountKey)
		: null;
	const departmentDe = departmentNames?.de || '';
	const departmentEn = departmentNames?.en || '';

	let nextTemplate = template.replace(/\$person_name/g, displayName);
	if (departmentDe === '' && departmentEn === '') {
		nextTemplate = nextTemplate.replace(/^.*\$department_de.*(?:\r?\n)?/gm, '');
		nextTemplate = nextTemplate.replace(/^.*\$department_en.*(?:\r?\n)?/gm, '');
	} else {
		nextTemplate = nextTemplate.replace(/\$department_de/g, departmentDe);
		nextTemplate = nextTemplate.replace(/\$department_en/g, departmentEn);
	}
	if (pronouns !== '') {
		nextTemplate = nextTemplate.replace(/\$pronouns/g, pronouns);
		return nextTemplate;
	}

	nextTemplate = nextTemplate.replace(/[^\s\n]*\$pronouns[^\s\n]*/g, '');
	nextTemplate = nextTemplate.replace(/\$pronouns/g, '');
	nextTemplate = nextTemplate.replace(/[ \t]{2,}/g, ' ');
	nextTemplate = nextTemplate.replace(/\n{3,}/g, '\n\n');
	return nextTemplate;
}

function AccountEmailAccountsOverview({
	user,
	editable = false,
	onDeleteEntry,
	onSetIdentitySignature,
	onEditAccount,
	onAddAdditionalAccount,
	emptyEditableState,
	sharedPrimaryAccountUserUids = [],
}: AccountEmailAccountsOverviewProps): ReactElement {
	const [identityEditorModal, setIdentityEditorModal] = useState<IdentityEditorModalState | null>(null);
	const [identityDisplayName, setIdentityDisplayName] = useState('');
	const [identitySignatureDraft, setIdentitySignatureDraft] = useState('');
	const [identityUseHtmlSignature, setIdentityUseHtmlSignature] = useState(false);
	const [identityTemplateLoading, setIdentityTemplateLoading] = useState(false);
	const [identitySaving, setIdentitySaving] = useState(false);
	const [templateSignatureModal, setTemplateSignatureModal] = useState<TemplateSignatureModalState | null>(null);
	const [templateSignatureDraft, setTemplateSignatureDraft] = useState('');
	const [templateUseHtmlSignature, setTemplateUseHtmlSignature] = useState(false);
	const [templateSignatureLoadingKey, setTemplateSignatureLoadingKey] = useState<string | null>(null);
	const [templateSignatureSaving, setTemplateSignatureSaving] = useState(false);
	const [signatureResultModal, setSignatureResultModal] = useState<{
		title: string
		message: string
		signature: string | null
	} | null>(null);
	const [deleteModal, setDeleteModal] = useState<DeleteEntryPayload | null>(null);
	const [deleteResultModal, setDeleteResultModal] = useState<{ title: string; message: string } | null>(null);
	const [deleteSubmitting, setDeleteSubmitting] = useState(false);

	if (!user) {
		return <p style={styles.validationMessage}>No account overview available.</p>;
	}

	const additionalEmailEntries = extractAdditionalAccountEmails(user.additionalAccounts);
	const primaryIdentityEntries = extractIdentityEntries(user.identities);
	const hasPrimaryEmail = Boolean(user.primaryEmail?.trim());
	const hasAnyConfiguredEmailAccounts = hasPrimaryEmail || additionalEmailEntries.length > 0;

	if (editable && !hasAnyConfiguredEmailAccounts && emptyEditableState) {
		return <>{emptyEditableState}</>;
	}

	const requestDelete = (event: MouseEvent<HTMLButtonElement>, payload: DeleteEntryPayload) => {
		event.preventDefault();
		setDeleteModal(payload);
	};

	const openAccountEditor = (event: MouseEvent<HTMLButtonElement>, payload: EditAccountPayload) => {
		event.preventDefault();
		if (typeof onEditAccount === 'function') {
			onEditAccount(payload);
		}
	};

	const openIdentityEditor = (
		event: MouseEvent<HTMLButtonElement>,
		entry: NormalizedIdentityEntry,
		prefix: string,
		index: number,
	) => {
		event.preventDefault();
		const identitySignature = typeof entry.signature === 'string' ? entry.signature : '';
		const { text, useHtml } = splitSignatureMarkup(identitySignature);
		setIdentityDisplayName(entry.name);
		setIdentitySignatureDraft(text);
		setIdentityUseHtmlSignature(useHtml);
		setIdentityTemplateLoading(false);
		setIdentitySaving(false);
		setIdentityEditorModal({
			prefix,
			index,
			identityId: entry.identityId,
			entry,
			uid: user.uid,
			accountKey: prefix === 'primary' ? undefined : prefix,
			accountType: prefix === 'primary' ? 'primary' : undefined,
			key: `${user.uid}-${prefix}-${index}`,
			displayName: entry.name,
			signature: identitySignature,
			accountEmail: prefix === 'primary'
				? String(user.primaryEmail || '').trim()
				: String(user.additionalAccounts?.[prefix]?.email || '').trim(),
		});
	};

	const closeIdentityEditor = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setIdentityEditorModal(null);
		setIdentityDisplayName('');
		setIdentitySignatureDraft('');
		setIdentityUseHtmlSignature(false);
		setIdentityTemplateLoading(false);
		setIdentitySaving(false);
	};

	const closeTemplateSignatureModal = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setTemplateSignatureModal(null);
		setTemplateSignatureDraft('');
		setTemplateUseHtmlSignature(false);
		setTemplateSignatureSaving(false);
	};

	const closeSignatureResultModal = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setSignatureResultModal(null);
	};

	const closeDeleteModal = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		if (deleteSubmitting) {
			return;
		}
		setDeleteModal(null);
	};

	const confirmDelete = (event: MouseEvent<HTMLButtonElement>) => {
		void (async () => {
			event.preventDefault();
			if (typeof onDeleteEntry !== 'function' || !deleteModal) {
				closeDeleteModal();
				return;
			}

			setDeleteSubmitting(true);
			try {
				const message = await onDeleteEntry(deleteModal);
				setDeleteResultModal({
					title: 'Delete result',
					message,
				});
			} catch (error) {
				setDeleteResultModal({
					title: 'Delete failed',
					message: error instanceof Error ? error.message : 'Delete action failed.',
				});
			} finally {
				setDeleteSubmitting(false);
				setDeleteModal(null);
			}
		})();
	};

	const closeDeleteResultModal = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setDeleteResultModal(null);
	};

	const saveIdentityChanges = (event: MouseEvent<HTMLButtonElement>) => {
		void (async () => {
			event.preventDefault();
			if (!identityEditorModal) {
				return;
			}

			setIdentitySaving(true);
			try {
				const storedSignature = serializeSignatureMarkup(identitySignatureDraft, identityUseHtmlSignature);
				const response = await apiRequest<{ message?: string }>(
					OC.generateUrl('/apps/hufak/api/snappymail/identity-signature'),
					{
						method: 'POST',
						headers: {
							'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
						},
						body: new URLSearchParams({
							uid: identityEditorModal.uid,
							index: String(identityEditorModal.index),
							displayName: identityDisplayName,
							signature: storedSignature,
							accountType: identityEditorModal.accountType || '',
							accountKey: identityEditorModal.accountKey || '',
						}),
					},
				);

				if (typeof onSetIdentitySignature === 'function') {
					onSetIdentitySignature({
						uid: identityEditorModal.uid,
						accountKey: identityEditorModal.accountKey,
						accountType: identityEditorModal.accountType,
						index: identityEditorModal.index,
						entry: identityEditorModal.entry,
						displayName: identityDisplayName,
						signature: storedSignature,
						prefix: identityEditorModal.prefix,
						key: identityEditorModal.key,
					});
				}
				closeIdentityEditor();
				setSignatureResultModal({
					title: 'Identity updated',
					message: response.message || 'Identity signature updated.',
					signature: storedSignature,
				});
			} catch (error) {
				setSignatureResultModal({
					title: 'Identity update failed',
					message: `Failed to update identity signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
					signature: null,
				});
			} finally {
				setIdentitySaving(false);
			}
		})();
	};

	const loadIdentitySignatureFromTemplate = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (!identityEditorModal) {
			return;
		}
		setIdentityTemplateLoading(true);
		try {
			const [signatureTemplateData, sharedMailboxesData] = await Promise.all([
				apiRequest<SignatureTemplateResponse>(
					OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				),
				apiRequest<SharedMailboxesResponse>(
					OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
				),
			]);
			const rawTemplate =
				typeof signatureTemplateData.template === 'string'
					? signatureTemplateData.template
					: '';
			const { text, useHtml } = splitSignatureMarkup(rawTemplate);
			setIdentitySignatureDraft(
				buildSignatureFromTemplate(
					text,
					user,
					identityEditorModal.accountEmail,
					(sharedMailboxesData.sharedMailboxes || {}) as Record<string, unknown>,
				),
			);
			setIdentityUseHtmlSignature(useHtml);
		} finally {
			setIdentityTemplateLoading(false);
		}
	};

	const openTemplateSignatureModal = (
		event: MouseEvent<HTMLButtonElement>,
		entry: NormalizedIdentityEntry,
		prefix: string,
		index: number,
	) => {
		void (async () => {
			event.preventDefault();
			const actionKey = `${user.uid}-${prefix}-${index}`;
			setTemplateSignatureLoadingKey(actionKey);
			try {
				const [signatureTemplateData, sharedMailboxesData] = await Promise.all([
					apiRequest<SignatureTemplateResponse>(
						OC.generateUrl('/apps/hufak/api/settings/signature-template'),
					),
					apiRequest<SharedMailboxesResponse>(
						OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
					),
				]);
				const rawTemplate =
					typeof signatureTemplateData.template === 'string'
						? signatureTemplateData.template
						: '';
				const { text, useHtml } = splitSignatureMarkup(rawTemplate);
				const generatedText = buildSignatureFromTemplate(
					text,
					user,
					prefix === 'primary'
						? String(user.primaryEmail || '').trim()
						: String(user.additionalAccounts?.[prefix]?.email || '').trim(),
					(sharedMailboxesData.sharedMailboxes || {}) as Record<string, unknown>,
				);
				setTemplateSignatureDraft(generatedText);
				setTemplateUseHtmlSignature(useHtml);
				setTemplateSignatureModal({
					prefix,
					index,
					entry,
					uid: user.uid,
					accountKey: prefix === 'primary' ? undefined : prefix,
					accountType: prefix === 'primary' ? 'primary' : undefined,
					key: actionKey,
					accountEmail: prefix === 'primary'
						? String(user.primaryEmail || '').trim()
						: String(user.additionalAccounts?.[prefix]?.email || '').trim(),
				});
			} catch (error) {
				setSignatureResultModal({
					title: 'Signature generation failed',
					message:
						error instanceof Error
							? error.message
							: 'Failed to generate signature from template.',
					signature: null,
				});
			} finally {
				setTemplateSignatureLoadingKey(null);
			}
		})();
	};

	const confirmTemplateSignature = (event: MouseEvent<HTMLButtonElement>) => {
		void (async () => {
			event.preventDefault();
			if (!templateSignatureModal) {
				return;
			}

			setTemplateSignatureSaving(true);
			try {
				const storedSignature = serializeSignatureMarkup(
					templateSignatureDraft,
					templateUseHtmlSignature,
				);
				const response = await apiRequest<{ message?: string }>(
					OC.generateUrl('/apps/hufak/api/snappymail/identity-signature'),
					{
						method: 'POST',
						headers: {
							'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
						},
						body: new URLSearchParams({
							uid: templateSignatureModal.uid,
							index: String(templateSignatureModal.index),
							displayName: templateSignatureModal.entry.name,
							signature: storedSignature,
							accountType: templateSignatureModal.accountType || '',
							accountKey: templateSignatureModal.accountKey || '',
						}),
					},
				);

				if (typeof onSetIdentitySignature === 'function') {
					onSetIdentitySignature({
						uid: templateSignatureModal.uid,
						accountKey: templateSignatureModal.accountKey,
						accountType: templateSignatureModal.accountType,
						index: templateSignatureModal.index,
						entry: templateSignatureModal.entry,
						displayName: templateSignatureModal.entry.name,
						signature: storedSignature,
						prefix: templateSignatureModal.prefix,
						key: templateSignatureModal.key,
					});
				}

				closeTemplateSignatureModal();
				setSignatureResultModal({
					title: 'Signature updated',
					message: response.message || 'Identity signature updated.',
					signature: storedSignature,
				});
			} catch (error) {
				setSignatureResultModal({
					title: 'Signature update failed',
					message: `Failed to update identity signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
					signature: null,
				});
			} finally {
				setTemplateSignatureSaving(false);
			}
		})();
	};

	const getDeleteConfirmationText = (): ReactNode => {
		if (!deleteModal) {
			return null;
		}
		if (deleteModal.type === 'primaryEmail') {
			return (
				<div style={styles.form}>
					<p style={styles.modalText}>
						Delete the primary account{' '}
						<code style={styles.monospaceCode}>{deleteModal.email || '-'}</code> for Nextcloud user{' '}
						<code style={styles.monospaceCode}>{user.uid}</code>?
					</p>
					{(additionalEmailEntries.length > 0 || sharedPrimaryAccountUserUids.length > 0) && (
						<p style={styles.modalText}>
							Please note that
							{additionalEmailEntries.length > 0 ? (
								<>
									{' '}the additional accounts{' '}
									{additionalEmailEntries.map((entry, index) => (
										<span key={`${entry.accountKey}-${entry.email}`}>
											{index > 0 ? ', ' : ''}
											<code style={styles.monospaceCode}>{entry.email}</code>
										</span>
									))}{' '}
									will remain linked to the primary account.
								</>
							) : (
								' this primary account remains linked to other users.'
							)}{' '}
							This primary account is currently used by {sharedPrimaryAccountUserUids.length} other users
							{sharedPrimaryAccountUserUids.length > 0 ? ' (' : '.'}
							{sharedPrimaryAccountUserUids.map((uid, index) => (
								<span key={uid}>
									{index > 0 ? ', ' : ''}
									<code style={styles.monospaceCode}>{uid}</code>
								</span>
							))}
							{sharedPrimaryAccountUserUids.length > 0 ? ')' : ''}
						</p>
					)}
				</div>
			);
		}
		if (deleteModal.type === 'additionalEmail') {
			return (
				<>
					Delete the additional account <code style={styles.monospaceCode}>{deleteModal.email || '-'}</code>?
				</>
			);
		}
		if (deleteModal.type === 'identity') {
			return <>Delete identity {getIdentityLabel(deleteModal.entry)}?</>;
		}
		return 'Delete this entry?';
	};

	const renderIdentityRows = (entries: NormalizedIdentityEntry[], prefix: string): ReactElement[] => {
		if (!editable || entries.length === 0) {
			return [];
		}

		return entries.map((entry, index) => {
			return (
			<li key={`${user.uid}-${prefix}-${index}`} style={styles.identityTreeItem}>
				<div style={{ ...styles.identityEntryRow, ...styles.identityCompactEntryRow }}>
					<span style={styles.identityListMarker} aria-hidden="true">
						-
					</span>
					<span style={{ ...styles.overviewTreeCell, ...styles.identityTreeCell }}>
						<span>
							{entry.name}
							{entry.name && entry.email ? ' ' : ''}
							{entry.email && (
								<>
									&lt;
									<code style={styles.monospaceCode}>{entry.email}</code>
									&gt;
								</>
							)}
						</span>
					</span>
					<div style={styles.identityActionsColumn}>
						{editable && (
							<div style={styles.identityActionButtonGroup}>
								<button
									type="button"
									onClick={(event) => openTemplateSignatureModal(event, entry, prefix, index)}
									disabled={templateSignatureLoadingKey === `${user.uid}-${prefix}-${index}`}
									style={
										templateSignatureLoadingKey === `${user.uid}-${prefix}-${index}`
											? { ...styles.identitySignatureButton, ...styles.disabledActionButton }
											: styles.identitySignatureButton
									}
									title="set signature from template"
									aria-label="set signature from template"
								>
									<svg
										viewBox="0 0 24 24"
										aria-hidden="true"
										style={styles.squareIcon}
									>
										<path
											fill="currentColor"
											d="M6 3H14L19 8V21H6V3M13 4.5V9H17.5L13 4.5M8 11H17V12.5H8V11M8 14H17V15.5H8V14M8 17H14V18.5H8V17Z"
										/>
									</svg>
								</button>
								<button
									type="button"
									onClick={(event) => openIdentityEditor(event, entry, prefix, index)}
									style={styles.entryEditButton}
									title="Edit identity"
									aria-label="Edit identity"
								>
									<span className="icon icon-rename" aria-hidden="true" />
								</button>
								{hasPrimaryEmail && (
									<button
										type="button"
										disabled={entry.identityId === '---'}
										onClick={(event) =>
											requestDelete(event, {
												type: 'identity',
												uid: user.uid,
												accountKey: prefix === 'primary' ? undefined : prefix,
												index,
												entry,
												accountType: prefix === 'primary' ? 'primary' : undefined,
											})
										}
										style={styles.entryDeleteButton}
										title={
											entry.identityId === '---'
												? 'cannot delete main identity'
												: `Delete identity ${entry.identityId}`
										}
										aria-label={
											entry.identityId === '---'
												? 'cannot delete main identity'
												: `Delete identity ${entry.identityId}`
										}
									>
										<span className="icon icon-delete" aria-hidden="true" />
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			</li>
			);
		});
	};

	const renderAccountRows = (): ReactElement[] => {
		const rows: ReactElement[] = [];
		if (editable) {
			rows.push(
				<li key={`${user.uid}-tree-header`} style={styles.accountTreeRow}>
					<div style={styles.identityColumnsHeader}>
						<span style={{ ...styles.identityHeaderCell, ...styles.identityAccountHeader }}>
							<>
								<strong>Primary e-mail account</strong>, <em>additional accounts</em> and identities
							</>
						</span>
						<span style={styles.identityHeaderCell} />
					</div>
				</li>,
			);
		}

		rows.push(
			<li key={`${user.uid}-primary-email`} style={styles.accountTreeRow}>
				<div style={editable ? styles.identityEntryRow : styles.identityEntryRowReadOnly}>
					<span style={styles.overviewTreeCell}>
						<span>
							<strong>
								<code style={styles.monospaceCode}>{user.primaryEmail || '-'}</code>
							</strong>
						</span>
					</span>
					<div style={styles.identityActionsColumn}>
						{editable && (
							<div style={styles.identityActionButtonGroup}>
								<button
									type="button"
									onClick={(event) =>
										openAccountEditor(event, {
											type: 'primaryEmail',
											uid: user.uid,
											email: user.primaryEmail,
										})
									}
									style={styles.entryEditButton}
									title="Edit primary account"
									aria-label="Edit primary account"
								>
									<span className="icon icon-rename" aria-hidden="true" />
								</button>
								<button
									type="button"
									onClick={(event) =>
										requestDelete(event, {
											type: 'primaryEmail',
											uid: user.uid,
											email: user.primaryEmail,
										})
									}
									style={styles.entryDeleteButton}
									title="Remove primary email"
									aria-label="Remove primary email"
								>
									<span className="icon icon-delete" aria-hidden="true" />
								</button>
							</div>
						)}
					</div>
				</div>
			</li>,
		);

		rows.push(...renderIdentityRows(primaryIdentityEntries, 'primary'));

		additionalEmailEntries.forEach(({ accountKey, email }) => {
			const identityEntries = extractIdentityEntries(user.additionalAccountIdentities?.[accountKey]);
			rows.push(
				<li key={`${user.uid}-additional-${accountKey}`} style={styles.additionalAccountTreeRow}>
					<div style={editable ? styles.identityEntryRow : styles.identityEntryRowReadOnly}>
						<span style={{ ...styles.overviewTreeCell, ...styles.additionalAccountTreeCell }}>
							<span style={styles.treeConnector} aria-hidden="true" />
							<code style={styles.monospaceCode}>{email}</code>
						</span>
						<div style={styles.identityActionsColumn}>
							{editable && (
								<div style={styles.identityActionButtonGroup}>
									<button
										type="button"
										onClick={(event) =>
											openAccountEditor(event, {
												type: 'additionalEmail',
												uid: user.uid,
												accountKey,
												email,
											})
										}
										disabled
										style={styles.entryEditButton}
										title="Edit account"
										aria-label="Edit account"
									>
										<span className="icon icon-rename" aria-hidden="true" />
									</button>
									<button
										type="button"
										onClick={(event) =>
											requestDelete(event, {
												type: 'additionalEmail',
												uid: user.uid,
												accountKey,
												email,
											})
										}
										style={styles.entryDeleteButton}
										title={`remove additional account ${email} from primary account ${user.primaryEmail || '-'}`}
										aria-label={`remove additional account ${email} from primary account ${user.primaryEmail || '-'}`}
									>
										<span className="icon icon-delete" aria-hidden="true" />
									</button>
								</div>
							)}
						</div>
					</div>
				</li>,
			);
			rows.push(...renderIdentityRows(identityEntries, accountKey));
		});

		if (editable) {
			rows.push(
				<li key={`${user.uid}-additional-add`} style={styles.additionalAccountTreeRow}>
					<div style={styles.identityEntryRow}>
						<span style={{ ...styles.overviewTreeCell, ...styles.additionalAccountTreeCell }}>
							<span style={styles.treeConnector} aria-hidden="true" />
							<button
								type="button"
								onClick={() => onAddAdditionalAccount?.(user.uid)}
								style={styles.mailboxAddButton}
								title="Add additional account"
								aria-label="Add additional account"
							>
								+
							</button>
						</span>
						<div />
					</div>
				</li>,
			);
		}

		return rows;
	};

	return (
		<>
			<ul style={editable ? styles.accountTreeListEditable : styles.accountTreeList}>
				{renderAccountRows()}
			</ul>
			{identityEditorModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeIdentityEditor} role="presentation">
					<div style={styles.signatureModalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>
							<>
								Edit identity <code style={styles.monospaceCode}>{identityEditorModal.identityId}</code>{' '}
								for account <code style={styles.monospaceCode}>{identityEditorModal.accountEmail || '-'}</code>
							</>
						</h4>
						<div style={{ ...styles.form, gap: '6px', marginBottom: '12px' }}>
							<label style={styles.fieldLabel} htmlFor="hufak-identity-display-name">
								Sender display name
							</label>
							<input
								id="hufak-identity-display-name"
								type="text"
								value={identityDisplayName}
								onChange={(event) => setIdentityDisplayName(event.target.value)}
								style={{ ...styles.input, maxWidth: '100%' }}
								placeholder={`e.g. ${user.displayName?.trim() || user.name?.trim() || user.fullName?.trim() || user.uid}`}
								disabled={identitySaving}
							/>
						</div>
						<SignatureMarkupEditor
							text={identitySignatureDraft}
							useHtml={identityUseHtmlSignature}
							onTextChange={setIdentitySignatureDraft}
							onUseHtmlChange={setIdentityUseHtmlSignature}
							disabled={identitySaving}
							placeholder="no signature"
							actions={
								<button
									type="button"
									onClick={loadIdentitySignatureFromTemplate}
									disabled={identityTemplateLoading}
									style={styles.clearButton}
								>
									{identityTemplateLoading
										? 'Loading template...'
										: 'generate signature according to Hufak template'}
								</button>
							}
						/>
						<div style={styles.modalButtonRow}>
							<button
								type="button"
								onClick={saveIdentityChanges}
								style={styles.submitButton}
								disabled={identitySaving}
							>
								{identitySaving ? 'Saving...' : 'Save identity'}
							</button>
							<button type="button" onClick={closeIdentityEditor} style={styles.clearButton}>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
			{templateSignatureModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeTemplateSignatureModal} role="presentation">
					<div style={styles.signatureModalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>
							<>
								Set signature for identity <code style={styles.monospaceCode}>{templateSignatureModal.entry.identityId}</code>{' '}
								on account <code style={styles.monospaceCode}>{templateSignatureModal.accountEmail || '-'}</code>
							</>
						</h4>
						<SignatureMarkupEditor
							text={templateSignatureDraft}
							useHtml={templateUseHtmlSignature}
							onTextChange={setTemplateSignatureDraft}
							onUseHtmlChange={setTemplateUseHtmlSignature}
							disabled={templateSignatureSaving}
							placeholder="no signature"
						/>
						<div style={styles.modalButtonRow}>
							<button
								type="button"
								onClick={confirmTemplateSignature}
								style={styles.submitButton}
								disabled={templateSignatureSaving}
							>
								{templateSignatureSaving ? 'Saving...' : 'Confirm'}
							</button>
							<button type="button" onClick={closeTemplateSignatureModal} style={styles.clearButton}>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
			{deleteModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeDeleteModal} role="presentation">
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>Confirm deletion</h4>
						<div>{getDeleteConfirmationText()}</div>
						<div style={styles.modalButtonRow}>
							<button
								type="button"
								onClick={confirmDelete}
								style={styles.submitButton}
								disabled={deleteSubmitting}
							>
								{deleteSubmitting ? 'Deleting...' : 'Delete'}
							</button>
							<button
								type="button"
								onClick={closeDeleteModal}
								style={styles.clearButton}
								disabled={deleteSubmitting}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}
			{deleteResultModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeDeleteResultModal} role="presentation">
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>{deleteResultModal.title}</h4>
						<textarea
							readOnly
							value={deleteResultModal.message}
							autoComplete="off"
							style={styles.outputBox}
						/>
						<div style={styles.modalButtonRow}>
							<button
								type="button"
								onClick={closeDeleteResultModal}
								style={styles.clearButton}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
			{signatureResultModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeSignatureResultModal} role="presentation">
					<div style={styles.signatureModalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>{signatureResultModal.title}</h4>
						<textarea
							readOnly
							value={signatureResultModal.message}
							autoComplete="off"
							style={styles.outputBox}
						/>
						{signatureResultModal.signature && (
							<div style={{ marginTop: '12px' }}>
								<p style={styles.modalText}>Applied signature preview</p>
								<div style={styles.signaturePreviewPane}>
									<SignaturePreview signature={signatureResultModal.signature} />
								</div>
							</div>
						)}
						<div style={styles.modalButtonRow}>
							<button
								type="button"
								onClick={closeSignatureResultModal}
								style={styles.clearButton}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export { AccountEmailAccountsOverview };
