import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import type { SharedMailboxesResponse } from '../types';

interface MailboxConfigProps {
	emailDomain: string
	setEmailDomain: (value: string) => void
}

interface MailboxNameRow {
	id: string
	prefix: string
	de: string
	en: string
	extraFields: Record<string, unknown>
}

let mailboxRowId = 0;

function nextMailboxRowId(): string {
	mailboxRowId += 1;
	return `mailbox-row-${mailboxRowId}`;
}

function createMailboxNameRow(): MailboxNameRow {
	return {
		id: nextMailboxRowId(),
		prefix: '',
		de: '',
		en: '',
		extraFields: {},
	};
}

function normalizeMailboxRows(
	value: Record<string, unknown>,
): { rows: MailboxNameRow[]; extraEntries: Record<string, unknown> } {
	const rows: MailboxNameRow[] = [];
	const extraEntries: Record<string, unknown> = {};

	Object.entries(value).forEach(([prefix, entry]) => {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			extraEntries[prefix] = entry;
			return;
		}

		const record = entry as Record<string, unknown>;
		rows.push({
			id: nextMailboxRowId(),
			prefix,
			de: typeof record.de === 'string' ? record.de : '',
			en: typeof record.en === 'string' ? record.en : '',
			extraFields: Object.fromEntries(
				Object.entries(record).filter(([key]) => key !== 'de' && key !== 'en'),
			),
		});
	});

	return { rows, extraEntries };
}

function buildSharedMailboxPayload(
	rows: MailboxNameRow[],
	extraEntries: Record<string, unknown>,
): Record<string, unknown> {
	const result: Record<string, unknown> = { ...extraEntries };

	rows.forEach((row) => {
		const prefix = row.prefix.trim();
		if (prefix === '') {
			return;
		}

		result[prefix] = {
			...row.extraFields,
			de: row.de,
			en: row.en,
		};
	});

	return result;
}

function MailboxConfig({
	emailDomain: _emailDomain,
	setEmailDomain: _setEmailDomain,
}: MailboxConfigProps): ReactElement {
	const [mailboxRows, setMailboxRows] = useState<MailboxNameRow[]>([]);
	const [extraEntries, setExtraEntries] = useState<Record<string, unknown>>({});
	const [initialMailboxRows, setInitialMailboxRows] = useState<MailboxNameRow[]>([]);
	const [initialExtraEntries, setInitialExtraEntries] = useState<Record<string, unknown>>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');
	const [saveResultModal, setSaveResultModal] = useState<{ title: string; message: string } | null>(null);

	useEffect(() => {
		async function loadSharedMailboxes() {
			setLoading(true);
			try {
				const data = await apiRequest<SharedMailboxesResponse>(
					OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
				);
				const normalized = normalizeMailboxRows(data.sharedMailboxes || {});
				setMailboxRows(normalized.rows);
				setExtraEntries(normalized.extraEntries);
				setInitialMailboxRows(normalized.rows);
				setInitialExtraEntries(normalized.extraEntries);
				setStatus('');
			} catch (err) {
				setStatus(
					`Failed to load shared mailboxes: ${err instanceof Error ? err.message : 'Unknown error'}`,
				);
			} finally {
				setLoading(false);
			}
		}

		loadSharedMailboxes();
	}, []);

	const updateRow = (rowId: string, changes: Partial<MailboxNameRow>) => {
		setMailboxRows((current) =>
			current.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
		);
	};

	const saveSharedMailboxes = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		try {
			const serialized = JSON.stringify(
				buildSharedMailboxPayload(mailboxRows, extraEntries),
			);
			const body = new URLSearchParams({ sharedMailboxes: serialized });
			const data = await apiRequest<SharedMailboxesResponse>(
				OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
				{
					method: 'POST',
					headers: {
						'content-type':
							'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			const normalized = normalizeMailboxRows(data.sharedMailboxes || {});
			setMailboxRows(normalized.rows);
			setExtraEntries(normalized.extraEntries);
			setInitialMailboxRows(normalized.rows);
			setInitialExtraEntries(normalized.extraEntries);
			setStatus('');
			setSaveResultModal({
				title: 'Save result',
				message: data.message || 'Shared mailboxes saved.',
			});
		} catch (err) {
			const message = `Failed to save shared mailboxes: ${err instanceof Error ? err.message : 'Unknown error'}`;
			setStatus(message);
			setSaveResultModal({
				title: 'Save failed',
				message,
			});
		} finally {
			setSaving(false);
		}
	};

	const currentSerialized = JSON.stringify(buildSharedMailboxPayload(mailboxRows, extraEntries));
	const initialSerialized = JSON.stringify(
		buildSharedMailboxPayload(initialMailboxRows, initialExtraEntries),
	);
	const hasChanges = currentSerialized !== initialSerialized;
	const sortedMailboxRows = [...mailboxRows].sort((left, right) =>
		left.prefix.trim().localeCompare(right.prefix.trim(), undefined, { sensitivity: 'base' }),
	);

	return (
		<section style={styles.formSection}>
			<div style={styles.proseContent}>
				<h2>Department names</h2>
			</div>
			<form onSubmit={saveSharedMailboxes} style={styles.form}>
				<div style={styles.proseContent}>
					<p style={styles.hintText}>
						Edit department email prefixes and the German and English department names.
					</p>
				</div>
				<div style={styles.treeContainer}>
					{loading ? (
						<p>Loading shared mailboxes...</p>
					) : (
						<>
							<div style={styles.mailboxNamesGrid}>
								<div style={styles.mailboxNamesHeader}>Email prefix</div>
								<div style={styles.mailboxNamesHeader}>German name</div>
								<div style={styles.mailboxNamesHeader}>English name</div>
								{sortedMailboxRows.map((row) => (
									<div key={row.id} style={styles.mailboxNamesRow}>
										<div style={styles.mailboxPrefixField}>
											<input
												type="text"
												value={row.prefix}
												placeholder="Email prefix"
												onChange={(event) => {
													updateRow(row.id, { prefix: event.target.value });
												}}
												style={styles.treeKeyInput}
												disabled={saving}
											/>
											<button
												type="button"
												style={styles.mailboxDeleteButton}
												onClick={() => {
													setMailboxRows((current) =>
														current.filter((entry) => entry.id !== row.id),
													);
												}}
												disabled={saving}
												aria-label={`Remove ${row.prefix || 'new mailbox'}`}
												title="Remove mailbox"
											>
												x
											</button>
										</div>
										<label style={styles.mailboxLocaleField}>
											<input
												type="text"
												value={row.de}
												placeholder="German department name"
												onChange={(event) => {
													updateRow(row.id, { de: event.target.value });
												}}
												style={styles.treeValueInput}
												disabled={saving}
											/>
										</label>
										<label style={styles.mailboxLocaleField}>
											<input
												type="text"
												value={row.en}
												placeholder="English department name"
												onChange={(event) => {
													updateRow(row.id, { en: event.target.value });
												}}
												style={styles.treeValueInput}
												disabled={saving}
											/>
										</label>
									</div>
								))}
							</div>
							<div style={styles.mailboxNamesAddRow}>
									<button
										type="button"
										style={styles.mailboxAddButton}
									onClick={() => {
										setMailboxRows((current) => [...current, createMailboxNameRow()]);
									}}
										disabled={loading || saving}
										aria-label="Add mailbox"
										title="Add mailbox"
									>
										+
								</button>
							</div>
						</>
					)}
				</div>
				<div style={styles.buttonRow}>
					<button
						type="submit"
						style={styles.submitButton}
						disabled={loading || saving || !hasChanges}
					>
						{saving ? 'Saving...' : 'Save shared mailboxes'}
					</button>
					<button
						type="button"
						style={styles.clearButton}
						disabled={loading || saving || !hasChanges}
						onClick={() => {
							const resetRows = normalizeMailboxRows(
								buildSharedMailboxPayload(initialMailboxRows, initialExtraEntries),
							);
							setMailboxRows(resetRows.rows);
							setExtraEntries(resetRows.extraEntries);
							setStatus('');
						}}
					>
						Reset
					</button>
				</div>
				{status && <p style={styles.successMessage}>{status}</p>}
				{saveResultModal && (
					<div
						style={styles.modalBackdrop}
						onMouseDown={() => setSaveResultModal(null)}
						role="presentation"
					>
						<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
							<h4 style={styles.modalTitle}>{saveResultModal.title}</h4>
							<textarea
								readOnly
								value={saveResultModal.message}
								autoComplete="off"
								style={styles.outputBox}
							/>
							<div style={styles.modalButtonRow}>
								<button
									type="button"
									onClick={() => setSaveResultModal(null)}
									style={styles.clearButton}
								>
									Close
								</button>
							</div>
						</div>
					</div>
				)}
			</form>
		</section>
	);
}

export { MailboxConfig };
