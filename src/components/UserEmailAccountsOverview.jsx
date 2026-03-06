import React, { useState } from 'react';
import { extractAdditionalAccountEmails, extractIdentityEntries } from '../utils/accountUtils';
import { styles } from '../styles';

function UserEmailAccountsOverview({
	user,
	editable = false,
	onDeleteEntry,
	onSetIdentitySignature,
	onEditEntry,
}) {
	const [hoveredSignatureIdentity, setHoveredSignatureIdentity] = useState('');
	const [signatureModal, setSignatureModal] = useState(null);
	const [signatureDraft, setSignatureDraft] = useState('');

	if (!user) {
		return <p style={styles.validationMessage}>No account overview available.</p>;
	}

	const additionalEmailEntries = extractAdditionalAccountEmails(user.additionalAccounts);
	const primaryIdentityEntries = extractIdentityEntries(user.identities);
	const onDelete = (event, payload) => {
		event.preventDefault();
		if (typeof onDeleteEntry === 'function') {
			onDeleteEntry(payload);
		}
	};
	const onEdit = (event, payload) => {
		event.preventDefault();
		if (typeof onEditEntry === 'function') {
			onEditEntry(payload);
		}
	};
	const openSignatureEditor = (event, entry, prefix, index) => {
		event.preventDefault();
		const identitySignature = typeof entry.signature === 'string' ? entry.signature : '';
		setSignatureDraft(identitySignature);
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
	const closeSignatureEditor = (event) => {
		if (event) {
			event.preventDefault();
		}
		setSignatureModal(null);
		setSignatureDraft('');
	};
	const saveSignatureForIdentity = (event) => {
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

	const renderIdentityRows = (entries, prefix) => {
		if (!entries || entries.length === 0) {
			return [];
		}

		return entries.map((entry, index) => {
			const identitySignature =
				typeof entry.signature === 'string' ? entry.signature : '';
			const signatureKey = `${user.uid}-${prefix}-${index}`;
			const isActiveSignature = signatureModal?.key === signatureKey;
			const signaturePreview = isActiveSignature && editable ? signatureDraft : identitySignature;
			const signatureHoverKey = `${user.uid}-${prefix}-${index}`;
			return (
				<li key={`${user.uid}-${prefix}-${index}`} style={styles.identityTreeItem}>
					<div style={styles.identityEntryRow}>
						<span style={styles.overviewTreeCell}>
							<span style={styles.treeConnector}>└─</span>
							<span>
								{entry.name}
								{entry.name && entry.email ? ' ' : ''}
								{entry.email && (
									<>
										&lt;
										<code>{entry.email}</code>
										&gt;
									</>
								)}
							</span>
						</span>
						<div style={styles.identitySignatureColumn}>
							{editable && (
								<span
									style={styles.identitySignatureWrapper}
									role="img"
									aria-label="Identity signature"
									onMouseEnter={() => setHoveredSignatureIdentity(signatureHoverKey)}
									onMouseLeave={() => setHoveredSignatureIdentity('')}
								>
									✍️
									{hoveredSignatureIdentity === signatureHoverKey && (
										<div style={styles.identitySignatureTooltip}>
											<pre style={styles.identitySignatureTooltipPre}>
												{signaturePreview.trim() === '' ? 'No signature' : signaturePreview}
											</pre>
										</div>
									)}
								</span>
							)}
						</div>
						<div style={styles.identitySetColumn}>
							{editable && (
								<button
									type="button"
									onClick={(event) => openSignatureEditor(event, entry, prefix, index)}
									style={styles.identitySignatureSetButton}
									title="Set signature"
									aria-label="Set signature"
								>
									🔁
								</button>
							)}
						</div>
						<div style={styles.identityDeleteColumn}>
							{editable && (
								<button
									type="button"
									onClick={(event) =>
										onDelete(event, {
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
									✖️
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
									✏️
								</button>
							)}
						</div>
					</div>
				</li>
			);
		});
	};

	const renderAccountRows = () => {
		const rows = [];
		if (editable) {
			rows.push(
				<li key={`${user.uid}-tree-header`} style={styles.accountTreeRow}>
					<div style={styles.identityColumnsHeader}>
						<span style={styles.identityHeaderCell} />
						<span style={{ ...styles.identityHeaderCell, ...styles.identitySignatureHeader }}>
							signature
						</span>
						<span style={{ ...styles.identityHeaderCell, ...styles.identityAccountHeader }}>
							account
						</span>
					</div>
				</li>,
			);
		}
		rows.push(
			<li key={`${user.uid}-primary-email`} style={styles.accountTreeRow}>
				<div style={styles.identityEntryRow}>
					<span style={styles.overviewTreeCell}>
						<span style={styles.treeConnector}>└─</span>
						<span>
							<strong>{user.primaryEmail || '-'}</strong>
						</span>
					</span>
					<div />
					<div />
					<div style={styles.identityDeleteColumn}>
						{editable && (
							<button
								type="button"
								onClick={(event) =>
									onDelete(event, {
										type: 'primaryEmail',
										uid: user.uid,
										email: user.primaryEmail,
									})
								}
								style={styles.entryDeleteButton}
								title="Remove primary email"
								aria-label="Remove primary email"
							>
								✖️
							</button>
						)}
					</div>
					<div style={styles.identityEditColumn}>
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
								✏️
							</button>
						)}
					</div>
				</div>
			</li>,
		);
		rows.push(...renderIdentityRows(primaryIdentityEntries, 'primary'));
		additionalEmailEntries.forEach(({ accountKey, email }) => {
			const identityEntries = extractIdentityEntries(
				user.additionalAccountIdentities?.[accountKey],
			);
			rows.push(
				<li
					key={`${user.uid}-additional-${accountKey}`}
					style={styles.additionalAccountTreeRow}
				>
					<div style={styles.identityEntryRow}>
						<span style={{ ...styles.overviewTreeCell, ...styles.additionalAccountTreeCell }}>
							<span style={styles.treeConnector}>└─</span>
							<span>{email}</span>
						</span>
						<div />
						<div />
					<div style={styles.identityDeleteColumn}>
						{editable && (
							<button
								type="button"
									onClick={(event) =>
										onDelete(event, {
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
								✖️
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
								✏️
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
				<div
					style={styles.modalBackdrop}
					onMouseDown={closeSignatureEditor}
					role="presentation"
				>
					<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
						<h4 style={styles.modalTitle}>Set identity signature</h4>
						<p style={styles.modalText}>
							{signatureModal.entry?.name || signatureModal.entry?.Name || 'Identity'}
						</p>
						<textarea
							value={signatureDraft}
							onChange={(event) => setSignatureDraft(event.target.value)}
							style={styles.modalTextarea}
							rows={10}
						/>
						<div style={styles.modalButtonRow}>
							<button type="button" onClick={saveSignatureForIdentity} style={styles.submitButton}>
								🟢 set
							</button>
							<button type="button" onClick={closeSignatureEditor} style={styles.clearButton}>
								❌ cancel
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

export { UserEmailAccountsOverview };
