import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement, ReactNode } from 'react';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { objectToTreeNodes, treeNodesToObject, updateTreeNode } from '../utils/treeUtils';
import type { SharedMailboxNode, SharedMailboxesResponse } from '../types';

interface MailboxConfigProps {
	emailDomain: string
	setEmailDomain: (value: string) => void
}

function MailboxConfig({
	emailDomain: _emailDomain,
	setEmailDomain: _setEmailDomain,
}: MailboxConfigProps): ReactElement {
	const [treeNodes, setTreeNodes] = useState<SharedMailboxNode[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadSharedMailboxes() {
			setLoading(true);
			try {
				const data = await apiRequest<SharedMailboxesResponse>(
					OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
				);
				setTreeNodes(objectToTreeNodes(data.sharedMailboxes || {}));
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

	const saveSharedMailboxes = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaving(true);
		try {
			const serialized = JSON.stringify(treeNodesToObject(treeNodes));
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
			setTreeNodes(objectToTreeNodes(data.sharedMailboxes || {}));
			setStatus('Shared mailboxes saved.');
		} catch (err) {
			setStatus(
				`Failed to save shared mailboxes: ${err instanceof Error ? err.message : 'Unknown error'}`,
			);
		} finally {
			setSaving(false);
		}
	};

	const renderNodes = (nodes: SharedMailboxNode[], depth = 0): ReactNode => {
		if (!Array.isArray(nodes) || nodes.length === 0) {
			return null;
		}

		return (
			<div style={{ ...styles.treeLevel, marginLeft: depth * 18 }}>
				{nodes.map((node) => (
					<div key={node.id}>
						<div style={styles.treeRow}>
							<input
								type="text"
								value={node.key}
								onChange={(event) => {
									setTreeNodes((current) =>
										updateTreeNode(current, node.id, (existing) => ({
											...existing,
											key: event.target.value,
										})),
									);
								}}
								style={styles.treeKeyInput}
								disabled={loading || saving}
							/>
							{node.type === 'value' && (
								<input
									type="text"
									value={node.value ?? ''}
									onChange={(event) => {
										setTreeNodes((current) =>
											updateTreeNode(current, node.id, (existing) => ({
												...existing,
												value: event.target.value,
											})),
										);
									}}
									style={styles.treeValueInput}
									disabled={loading || saving}
								/>
							)}
						</div>
						{node.type === 'object' && renderNodes(node.children || [], depth + 1)}
					</div>
				))}
			</div>
		);
	};

	return (
		<section style={styles.formSection}>
			<h2>Shared mailboxes</h2>
			<form onSubmit={saveSharedMailboxes} style={styles.form}>
				<p style={styles.hintText}>
					Edit shared mailbox keys and values in a hierarchical structure.
				</p>
				<div style={styles.treeContainer}>
					{loading ? <p>Loading shared mailboxes...</p> : renderNodes(treeNodes)}
				</div>
				<button type="submit" style={styles.submitButton} disabled={loading || saving}>
					{saving ? 'Saving...' : 'Save shared mailboxes'}
				</button>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

export { MailboxConfig };
