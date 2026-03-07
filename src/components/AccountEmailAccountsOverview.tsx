import { useState } from 'react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';
import { apiRequest } from '../api';
import { extractAdditionalAccountEmails, extractIdentityEntries } from '../utils/accountUtils';
import { styles } from '../styles';
import { SignaturePreview } from './SignaturePreview';
import type {
	DeleteEntryPayload,
	EditEntryPayload,
	IdentityEntry,
	MailboxUser,
	NormalizedIdentityEntry,
	SetIdentitySignaturePayload,
	SignatureTemplateResponse,
} from '../types';

interface SignatureModalState {
	prefix: string
	index: number
	entry: IdentityEntry | NormalizedIdentityEntry
	uid: string
	accountKey?: string
	accountType?: 'primary'
	key: string
	signature: string
}

interface AccountEmailAccountsOverviewProps {
	user: MailboxUser | null
	editable?: boolean
	onDeleteEntry?: (payload: DeleteEntryPayload) => void
	onSetIdentitySignature?: (payload: SetIdentitySignaturePayload) => void
	onEditEntry?: (payload: EditEntryPayload) => void
	primaryAction?: ReactNode
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

function getIdentityModalTitle(entry?: IdentityEntry | NormalizedIdentityEntry): string {
	if (!entry) {
		return 'Edit signature';
	}

	const name =
		'name' in entry && typeof entry.name === 'string' && entry.name.trim() !== ''
			? entry.name.trim()
			: 'Name' in entry && typeof entry.Name === 'string' && entry.Name.trim() !== ''
				? entry.Name.trim()
				: '';

	const email =
		'email' in entry && typeof entry.email === 'string' && entry.email.trim() !== ''
			? entry.email.trim()
			: 'Email' in entry && typeof entry.Email === 'string' && entry.Email.trim() !== ''
				? entry.Email.trim()
				: '';

	if (name && email) {
		return `Edit signature for ${name} <${email}>`;
	}
	if (name) {
		return `Edit signature for ${name}`;
	}
	if (email) {
		return `Edit signature for <${email}>`;
	}
	return 'Edit signature';
}

function buildSignatureFromTemplate(template: string, user: MailboxUser): string {
	const displayName =
		user.accountName?.trim() ||
		user.displayName?.trim() ||
		user.name?.trim() ||
		user.fullName?.trim() ||
		user.uid.trim();
	const pronouns = user.pronouns?.trim() || user.pronoun?.trim() || '';

	let nextTemplate = template.replace(/\$person_name/g, displayName);
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
	onEditEntry,
	primaryAction,
}: AccountEmailAccountsOverviewProps): ReactElement {
	const [signatureModal, setSignatureModal] = useState<SignatureModalState | null>(null);
	const [signatureDraft, setSignatureDraft] = useState('');
	const [templateLoading, setTemplateLoading] = useState(false);
	const [deleteModal, setDeleteModal] = useState<DeleteEntryPayload | null>(null);

	if (!user) {
		return <p style={styles.validationMessage}>No account overview available.</p>;
	}

	const additionalEmailEntries = extractAdditionalAccountEmails(user.additionalAccounts);
	const primaryIdentityEntries = extractIdentityEntries(user.identities);

	const requestDelete = (event: MouseEvent<HTMLButtonElement>, payload: DeleteEntryPayload) => {
		event.preventDefault();
		setDeleteModal(payload);
	};

	const onEdit = (event: MouseEvent<HTMLButtonElement>, payload: EditEntryPayload) => {
		event.preventDefault();
		if (typeof onEditEntry === 'function') {
			onEditEntry(payload);
		}
	};

	const openSignatureEditor = (
		event: MouseEvent<HTMLButtonElement>,
		entry: NormalizedIdentityEntry,
		prefix: string,
		index: number,
	) => {
		event.preventDefault();
		const identitySignature = typeof entry.signature === 'string' ? entry.signature : '';
		setSignatureDraft(identitySignature);
		setTemplateLoading(false);
		setSignatureModal({
			prefix,
			index,
			entry,
			uid: user.uid,
			accountKey: prefix === 'primary' ? undefined : prefix,
			accountType: prefix === 'primary' ? 'primary' : undefined,
			key: `${user.uid}-${prefix}-${index}`,
			signature: identitySignature,
		});
	};

	const closeSignatureEditor = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setSignatureModal(null);
		setSignatureDraft('');
		setTemplateLoading(false);
	};

	const closeDeleteModal = (event?: MouseEvent<HTMLElement>) => {
		if (event) {
			event.preventDefault();
		}
		setDeleteModal(null);
	};

	const confirmDelete = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (typeof onDeleteEntry === 'function' && deleteModal) {
			onDeleteEntry(deleteModal);
		}
		closeDeleteModal();
	};

	const saveSignatureForIdentity = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		if (typeof onSetIdentitySignature === 'function' && signatureModal) {
			onSetIdentitySignature({
				uid: signatureModal.uid,
				accountKey: signatureModal.accountKey,
				accountType: signatureModal.accountType,
				index: signatureModal.index,
				entry: signatureModal.entry,
				signature: signatureDraft,
				prefix: signatureModal.prefix,
				key: signatureModal.key,
			});
		}
		closeSignatureEditor();
	};

	const generateSignatureFromTemplate = async (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		setTemplateLoading(true);
		try {
			const data = await apiRequest<SignatureTemplateResponse>(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
			);
			setSignatureDraft(
				typeof data.template === 'string' ? buildSignatureFromTemplate(data.template, user) : '',
			);
		} finally {
			setTemplateLoading(false);
		}
	};

	const getDeleteConfirmationText = (): string => {
		if (!deleteModal) {
			return '';
		}
		if (deleteModal.type === 'primaryEmail') {
			return `Delete the primary account ${deleteModal.email || '-'}?`;
		}
		if (deleteModal.type === 'additionalEmail') {
			return `Delete the additional account ${deleteModal.email || '-'}?`;
		}
		if (deleteModal.type === 'identity') {
			return `Delete identity ${getIdentityLabel(deleteModal.entry)}?`;
		}
		return 'Delete this entry?';
	};

	const renderIdentityRows = (entries: NormalizedIdentityEntry[], prefix: string): ReactElement[] => {
		if (entries.length === 0) {
			return [];
		}

		return entries.map((entry, index) => (
			<li key={`${user.uid}-${prefix}-${index}`} style={styles.identityTreeItem}>
				<div style={styles.identityEntryRow}>
					<span style={{ ...styles.overviewTreeCell, ...styles.identityTreeCell }}>
						<span style={styles.treeConnector}>└─</span>
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
					<div style={styles.identitySignatureColumn}>
						{editable && (
							<button
								type="button"
								onClick={(event) => openSignatureEditor(event, entry, prefix, index)}
								style={styles.identitySignatureButton}
								title="Edit signature"
								aria-label="Edit signature"
							>
								<span className="icon icon-customize" aria-hidden="true" />
								<span>signature</span>
							</button>
						)}
					</div>
					<div style={styles.identityDeleteColumn}>
						{editable && (
							<button
								type="button"
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
									title="Remove identity"
									aria-label="Remove identity"
								>
									<span className="icon icon-delete" aria-hidden="true" />
								</button>
							)}
						</div>
					<div style={styles.identityEditColumn}>
						{editable && (
							<button
								type="button"
								onClick={(event) =>
									onEdit(event, {
										type: 'identity',
										uid: user.uid,
										accountKey: prefix === 'primary' ? undefined : prefix,
										index,
										entry,
										accountType: prefix === 'primary' ? 'primary' : undefined,
									})
								}
									style={styles.entryEditButton}
									title="Edit identity"
									aria-label="Edit identity"
								>
									<span className="icon icon-rename" aria-hidden="true" />
								</button>
							)}
						</div>
				</div>
			</li>
		));
	};

	const renderAccountRows = (): ReactElement[] => {
		const rows: ReactElement[] = [];
		if (editable) {
			rows.push(
				<li key={`${user.uid}-tree-header`} style={styles.accountTreeRow}>
					<div style={styles.identityColumnsHeader}>
						<span style={styles.identityHeaderCell} />
						<span style={styles.identityHeaderCell}>signature</span>
						<span style={{ ...styles.identityHeaderCell, ...styles.identityAccountHeader }}>account</span>
					</div>
				</li>,
			);
		}

		rows.push(
			<li key={`${user.uid}-primary-email`} style={styles.accountTreeRow}>
				<div style={styles.identityEntryRow}>
					<span style={styles.overviewTreeCell}>
						<span>
							<strong>
								<code style={styles.monospaceCode}>{user.primaryEmail || '-'}</code>
							</strong>
						</span>
					</span>
					<div />
					<div style={styles.identityDeleteColumn}>
						{editable && (
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
						)}
					</div>
					<div style={styles.identityEditColumn}>
						{primaryAction}
						{editable && (
							<button
								type="button"
								onClick={(event) =>
									onEdit(event, {
										type: 'primaryEmail',
										uid: user.uid,
										email: user.primaryEmail,
									})
								}
								style={styles.entryEditButton}
								title="Edit primary email"
								aria-label="Edit primary email"
							>
								<span className="icon icon-rename" aria-hidden="true" />
							</button>
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
					<div style={styles.identityEntryRow}>
						<span style={{ ...styles.overviewTreeCell, ...styles.additionalAccountTreeCell }}>
							<span style={styles.treeConnector}>└─</span>
							<code style={styles.monospaceCode}>{email}</code>
						</span>
						<div />
						<div style={styles.identityDeleteColumn}>
							{editable && (
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
									title="Remove additional email"
									aria-label="Remove additional email"
								>
									<span className="icon icon-delete" aria-hidden="true" />
								</button>
							)}
						</div>
						<div style={styles.identityEditColumn}>
							{editable && (
								<button
									type="button"
									onClick={(event) =>
										onEdit(event, {
											type: 'additionalEmail',
											uid: user.uid,
											accountKey,
											email,
										})
									}
									style={styles.entryEditButton}
									title="Edit additional email"
									aria-label="Edit additional email"
								>
									<span className="icon icon-rename" aria-hidden="true" />
								</button>
							)}
						</div>
					</div>
				</li>,
			);
			rows.push(...renderIdentityRows(identityEntries, accountKey));
		});

		return rows;
	};

	return (
		<>
			<ul style={styles.accountTreeList}>{renderAccountRows()}</ul>
			{signatureModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeSignatureEditor} role="presentation">
					<div style={styles.signatureModalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>{getIdentityModalTitle(signatureModal.entry)}</h4>
						<div style={styles.signatureEditorLayout}>
							<div style={styles.signatureEditorPane}>
								<textarea
									value={signatureDraft}
									onChange={(event) => setSignatureDraft(event.target.value)}
									style={styles.modalTextarea}
									rows={12}
								/>
								<button
									type="button"
									onClick={generateSignatureFromTemplate}
									disabled={templateLoading}
									style={styles.clearButton}
								>
									{templateLoading
										? 'Loading template...'
										: 'generate signature according to Hufak template'}
								</button>
							</div>
							<div style={styles.signaturePreviewPane}>
								<SignaturePreview signature={signatureDraft} />
							</div>
						</div>
						<div style={styles.modalButtonRow}>
							<button type="button" onClick={saveSignatureForIdentity} style={styles.submitButton}>
								save
							</button>
							<button type="button" onClick={closeSignatureEditor} style={styles.clearButton}>
								cancel
							</button>
						</div>
					</div>
				</div>
			)}
			{deleteModal && (
				<div style={styles.modalBackdrop} onMouseDown={closeDeleteModal} role="presentation">
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>Confirm deletion</h4>
						<p style={styles.modalText}>{getDeleteConfirmationText()}</p>
						<div style={styles.modalButtonRow}>
							<button type="button" onClick={confirmDelete} style={styles.submitButton}>
								delete
							</button>
							<button type="button" onClick={closeDeleteModal} style={styles.clearButton}>
								cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export { AccountEmailAccountsOverview };
