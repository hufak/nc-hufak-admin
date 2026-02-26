import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const SECTION_KEYS = {
	OVERVIEW: 'overview',
	ADD_USER: 'add-user',
	CONFIGURE_MAIL: 'configure-mail',
	MAILBOX_CONFIG: 'mailbox-config',
	CHECK_STATUS: 'check-status',
	SIGNATURE_TEMPLATE: 'signature-template',
};
const DEFAULT_EMAIL_DOMAIN = 'hufak.net';

const SECTIONS = [
	{ key: SECTION_KEYS.OVERVIEW, label: 'overview' },
	{ key: SECTION_KEYS.ADD_USER, label: 'add user' },
	{ key: SECTION_KEYS.CONFIGURE_MAIL, label: 'user mailboxes' },
	{ key: SECTION_KEYS.MAILBOX_CONFIG, label: 'shared mailboxes' },
	{ key: SECTION_KEYS.CHECK_STATUS, label: 'user overview' },
	{ key: SECTION_KEYS.SIGNATURE_TEMPLATE, label: 'signature template' },
];

function parseSectionFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const requested = params.get('section');
	return SECTIONS.some((section) => section.key === requested)
		? requested
		: SECTION_KEYS.OVERVIEW;
}

function updateUrlSection(section) {
	const url = new URL(window.location.href);
	url.searchParams.set('section', section);
	window.history.pushState({}, '', url.toString());
}

function fullNameIsValid(value) {
	return /^([A-Z][A-Za-z]*)( [A-Z][A-Za-z]*)+$/.test(value.trim());
}

function usernameFromFullName(value) {
	return value.trim().toLowerCase().replace(/\s+/g, '.');
}

function buildEmailFromUsername(username, emailDomain) {
	return `${username}@${emailDomain}`;
}

function formatTimeSince(timestampSeconds) {
	const ts = Number(timestampSeconds);
	if (!Number.isFinite(ts) || ts <= 0) {
		return 'never';
	}

	const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - ts);
	if (diffSeconds < 60) {
		return 'just now';
	}

	const steps = [
		{ unit: 'year', seconds: 365 * 24 * 60 * 60 },
		{ unit: 'month', seconds: 30 * 24 * 60 * 60 },
		{ unit: 'day', seconds: 24 * 60 * 60 },
		{ unit: 'hour', seconds: 60 * 60 },
		{ unit: 'minute', seconds: 60 },
	];

	for (const step of steps) {
		if (diffSeconds >= step.seconds) {
			const value = Math.floor(diffSeconds / step.seconds);
			return `${value} ${step.unit}${value === 1 ? '' : 's'} ago`;
		}
	}

	return 'just now';
}

function extractAdditionalAccountEmails(additionalAccounts) {
	if (!additionalAccounts || typeof additionalAccounts !== 'object') {
		return [];
	}

	return Object.entries(additionalAccounts)
		.map(([accountKey, entry]) => ({
			accountKey,
			email:
				entry && typeof entry === 'object' && typeof entry.email === 'string'
					? entry.email.trim()
					: '',
		}))
		.filter((entry) => entry.email !== '');
}

function extractIdentityEntries(identities) {
	if (!identities || typeof identities !== 'object') {
		return [];
	}

	const entries = Array.isArray(identities) ? identities : Object.values(identities);
	return entries
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return null;
			}
			const name = typeof entry.Name === 'string' ? entry.Name.trim() : '';
			const email =
				typeof entry.Email === 'string'
					? entry.Email.trim()
					: typeof entry.email === 'string'
						? entry.email.trim()
						: '';
			if (!name && !email) {
				return null;
			}
			return { name, email };
		})
		.filter((entry) => entry !== null);
}

function isInactiveOverMonth(timestampSeconds) {
	const ts = Number(timestampSeconds);
	if (!Number.isFinite(ts) || ts <= 0) {
		return true;
	}
	const nowSeconds = Math.floor(Date.now() / 1000);
	return nowSeconds - ts > 30 * 24 * 60 * 60;
}

let sharedMailboxNodeId = 0;
function nextSharedMailboxNodeId() {
	sharedMailboxNodeId += 1;
	return `shared-mailbox-node-${sharedMailboxNodeId}`;
}

function objectToTreeNodes(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return [];
	}

	return Object.entries(value).map(([key, childValue]) => {
		if (childValue && typeof childValue === 'object' && !Array.isArray(childValue)) {
			return {
				id: nextSharedMailboxNodeId(),
				key,
				type: 'object',
				children: objectToTreeNodes(childValue),
			};
		}

		return {
			id: nextSharedMailboxNodeId(),
			key,
			type: 'value',
			value: childValue == null ? '' : String(childValue),
		};
	});
}

function treeNodesToObject(nodes) {
	const result = {};
	nodes.forEach((node) => {
		if (!node?.key) {
			return;
		}
		if (node.type === 'object') {
			result[node.key] = treeNodesToObject(node.children || []);
		} else {
			result[node.key] = node.value ?? '';
		}
	});
	return result;
}

function updateTreeNode(nodes, targetId, updater) {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return updater(node);
		}
		if (node.type === 'object' && Array.isArray(node.children)) {
			return {
				...node,
				children: updateTreeNode(node.children, targetId, updater),
			};
		}
		return node;
	});
}

async function apiRequest(url, options = {}) {
	const { headers = {}, ...requestOptions } = options;
	const response = await fetch(url, {
		credentials: 'same-origin',
		...requestOptions,
		headers: {
			requesttoken: OC.requestToken,
			accept: 'application/json',
			...headers,
		},
	});
	if (!response.ok) {
		let message = `Unexpected status: ${response.status}`;
		try {
			const errorData = await response.json();
			if (typeof errorData?.message === 'string' && errorData.message.trim() !== '') {
				message = errorData.message;
			}
		} catch {
			// Keep default status message when error payload is not JSON.
		}
		throw new Error(message);
	}
	return response.json();
}

function AddUser({ emailDomain }) {
	const [fullName, setFullName] = useState('');
	const [pronoun, setPronoun] = useState('');
	const [username, setUsername] = useState('');
	const [email, setEmail] = useState(buildEmailFromUsername('', emailDomain));
	const [isCreating, setIsCreating] = useState(false);
	const [creationOutput, setCreationOutput] = useState('');
	const isFullNameValid = fullNameIsValid(fullName);

	const onFullNameChange = (event) => {
		const nextFullName = event.target.value;
		setFullName(nextFullName);
		setUsername(usernameFromFullName(nextFullName));
	};

	useEffect(() => {
		setEmail(buildEmailFromUsername(username, emailDomain));
	}, [username, emailDomain]);

	const onSubmit = async (event) => {
		event.preventDefault();
		if (!isFullNameValid) {
			setCreationOutput(
				'Validation error: full name must contain at least two capitalized words.',
			);
			return;
		}

		setIsCreating(true);
		setCreationOutput('Creating user...');

		try {
			const body = new URLSearchParams({
				fullName,
				pronoun,
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
			const lines = [data.message || 'User created'];
			if (data.password) {
				lines.push(`Random password: ${data.password}`);
			}
			setCreationOutput(lines.join('\n'));
		} catch (err) {
			setCreationOutput(
				`Error: ${err instanceof Error ? err.message : 'User creation failed'}`,
			);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>Add user</h2>
			<form onSubmit={onSubmit} style={styles.form}>
				<label style={styles.fieldLabel} htmlFor="hufak-full-name">
					full name
				</label>
				<input
					id="hufak-full-name"
					type="text"
					value={fullName}
					onChange={onFullNameChange}
					placeholder="John Doe"
					style={styles.input}
				/>
				{fullName.length > 0 && !isFullNameValid && (
					<p style={styles.validationMessage}>
						Use two or more words. Each word must start with a capital letter and
						contain letters only.
					</p>
				)}

				<label style={styles.fieldLabel} htmlFor="hufak-pronoun">
					pronoun
				</label>
				<input
					id="hufak-pronoun"
					type="text"
					value={pronoun}
					onChange={(event) => setPronoun(event.target.value)}
					placeholder="she/her"
					style={styles.input}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-username">
					username
				</label>
				<input
					id="hufak-username"
					type="text"
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					style={styles.input}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-email">
					email
				</label>
				<input
					id="hufak-email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					style={styles.input}
				/>
				<p style={styles.hintText}>
					Default domain from configuration: {emailDomain}
				</p>

				<button type="submit" disabled={!isFullNameValid || isCreating} style={styles.submitButton}>
					{isCreating ? 'Creating...' : 'create'}
				</button>
				<textarea
					readOnly
					value={creationOutput}
					style={styles.outputBox}
					placeholder="Status messages from user creation will appear here."
				/>
			</form>
		</section>
	);
}

function Overview() {
	return (
		<section style={styles.formSection}>
			<h2>Overview</h2>
			<ul style={styles.overviewList}>
				<li>
					<strong>overview</strong>: quick description of all tabs and their purpose.
				</li>
				<li>
					<strong>add user</strong>: create a Nextcloud user, generate credentials, and see
					creation status output.
				</li>
				<li>
					<strong>user mailboxes</strong>: select a user and set the primary SnappyMail
					account (email + password).
				</li>
				<li>
					<strong>shared mailboxes</strong>: edit the hierarchical shared mailbox config
					(`shared_mailboxes`).
				</li>
				<li>
					<strong>user overview</strong>: view account status, email account identities,
					apporder status, activity recency, and failed login attempts.
				</li>
				<li>
					<strong>signature template</strong>: edit and save the shared signature template
					stored in appdata.
				</li>
			</ul>
		</section>
	);
}

function ConfigureMail({ emailDomain, setEmailDomain }) {
	const [uids, setUids] = useState([]);
	const [selectedUid, setSelectedUid] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadUids() {
			try {
				const data = await apiRequest(OC.generateUrl('/apps/hufak/api/users/enabled-uids'));
				const nextUids = Array.isArray(data.uids) ? data.uids : [];
				setUids(nextUids);
				if (nextUids.length > 0) {
					setSelectedUid((current) => current || nextUids[0]);
				}
			} catch (err) {
				setStatus(
					`Failed to load users: ${err instanceof Error ? err.message : 'Unknown error'}`,
				);
			}
		}

		loadUids();
	}, []);

	const submitSettings = async (event) => {
		event.preventDefault();
		if (!selectedUid || !email || !password) {
			setStatus('Please provide user, e-mail and password.');
			return;
		}

		setSubmitting(true);
		setStatus('Setting primary e-mail account...');
		try {
			const body = new URLSearchParams({
				uid: selectedUid,
				email,
				password,
			});
			const data = await apiRequest(OC.generateUrl('/apps/hufak/api/snappymail/settings'), {
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
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
			setStatus(lines.join('\n'));
		} catch (err) {
			setStatus(
				`Failed to set primary e-mail account: ${err instanceof Error ? err.message : 'Unknown error'}`,
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>User mailboxes</h2>
			<form onSubmit={submitSettings} style={styles.form}>
				<label style={styles.fieldLabel} htmlFor="hufak-mailbox-user">
					user
				</label>
				<select
					id="hufak-mailbox-user"
					value={selectedUid}
					onChange={(event) => setSelectedUid(event.target.value)}
					style={styles.input}
				>
					{uids.length === 0 && <option value="">No enabled users found</option>}
					{uids.map((uid) => (
						<option key={uid} value={uid}>
							{uid}
						</option>
					))}
				</select>

				<label style={styles.fieldLabel} htmlFor="hufak-mailbox-email">
					e-mail
				</label>
				<input
					id="hufak-mailbox-email"
					type="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					style={styles.input}
				/>

				<label style={styles.fieldLabel} htmlFor="hufak-mailbox-password">
					password
				</label>
				<input
					id="hufak-mailbox-password"
					type="password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					style={styles.input}
				/>

				<button
					type="submit"
					disabled={submitting || !selectedUid || !email || !password}
					style={styles.submitButton}
				>
					{submitting ? 'Setting...' : 'set primary e-mail account'}
				</button>

				<textarea
					readOnly
					value={status}
					style={styles.outputBox}
					placeholder="Status output will appear here."
				/>
			</form>
		</section>
	);
}

function MailboxConfig({ emailDomain, setEmailDomain }) {
	const [treeNodes, setTreeNodes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadSharedMailboxes() {
			setLoading(true);
			try {
				const data = await apiRequest(
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

	const saveSharedMailboxes = async (event) => {
		event.preventDefault();
		setSaving(true);
		try {
			const serialized = JSON.stringify(treeNodesToObject(treeNodes));
			const body = new URLSearchParams({ sharedMailboxes: serialized });
			const data = await apiRequest(
				OC.generateUrl('/apps/hufak/api/settings/shared-mailboxes'),
				{
				method: 'POST',
				headers: {
					'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
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

	const renderNodes = (nodes, depth = 0) => {
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

function CheckStatus() {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [users, setUsers] = useState([]);
	const [disabledUsers, setDisabledUsers] = useState([]);

	useEffect(() => {
		async function loadUserStatus() {
			try {
				const data = await apiRequest(OC.generateUrl('/apps/hufak/api/users/status'));
				const nextUsers = Array.isArray(data.users) ? data.users : [];
				nextUsers.forEach((user) => {
					if (user?.additionalAccountsLookupError) {
						console.warn(
							`[hufak] additionalaccounts lookup failed for ${user.uid || 'unknown'}:`,
							user.additionalAccountsLookupError,
						);
					}
					if (user?.identitiesLookupError) {
						console.warn(
							`[hufak] identities lookup failed for ${user.uid || 'unknown'}:`,
							user.identitiesLookupError,
						);
					}
					if (user?.additionalAccountIdentitiesLookupErrors) {
						Object.entries(user.additionalAccountIdentitiesLookupErrors).forEach(
							([account, message]) => {
								console.warn(
									`[hufak] additional account identities lookup failed for ${user.uid || 'unknown'} (${account}):`,
									message,
								);
							},
						);
					}
				});
				setUsers(nextUsers);
				setDisabledUsers(Array.isArray(data.disabledUsers) ? data.disabledUsers : []);
				setError('');
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load status');
			} finally {
				setLoading(false);
			}
		}

		loadUserStatus();
	}, []);

	if (loading) {
		return (
			<section style={styles.formSection}>
				<h2>User overview</h2>
				<p>Loading account status...</p>
			</section>
		);
	}

	if (error) {
		return (
			<section style={styles.formSection}>
				<h2>User overview</h2>
				<p style={styles.validationMessage}>Failed to load status: {error}</p>
			</section>
		);
	}

	return (
		<section style={styles.formSection}>
			<h2>User overview</h2>
			<div style={styles.tableWrapper}>
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.tableHeader}>UID</th>
							<th style={styles.tableHeader}>Apporder status</th>
							<th style={styles.tableHeader}>Email accounts</th>
							<th style={styles.tableHeader}>Last activity</th>
							<th style={styles.tableHeader}>Failed login attempts</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => {
							const additionalEmailEntries = extractAdditionalAccountEmails(
								user.additionalAccounts,
							);
							const primaryIdentityEntries = extractIdentityEntries(user.identities);
							return (
								<tr key={user.uid}>
									<td style={styles.tableCell}>{user.uid}</td>
									<td style={styles.tableCell}>
										{user.apporderMatches ? (
											<span style={styles.statusOk} title="User apporder matches Hufak apporder">
												{'\u2713'}
											</span>
										) : (
											<span
												style={styles.statusWarn}
												title="User apporder differs from Hufak apporder"
											>
												!
											</span>
										)}
									</td>
									<td style={styles.tableCell}>
										<ul style={styles.additionalEmailList}>
											<li>
												<strong>{user.primaryEmail || '-'}</strong>
												{primaryIdentityEntries.length > 0 && (
													<ul style={styles.identityNameList}>
														{primaryIdentityEntries.map((entry, index) => (
															<li key={`${user.uid}-primary-name-${index}`}>
																{entry.name}
																{entry.name && entry.email ? ' ' : ''}
																{entry.email && (
																	<>
																		&lt;<code>{entry.email}</code>&gt;
																	</>
																)}
															</li>
														))}
													</ul>
												)}
											</li>
											{additionalEmailEntries.map(({ accountKey, email }) => {
												const identityEntries = extractIdentityEntries(
													user.additionalAccountIdentities?.[accountKey],
												);
												return (
													<li key={`${user.uid}-additional-${accountKey}`}>
														{email}
														{identityEntries.length > 0 && (
															<ul style={styles.identityNameList}>
																{identityEntries.map((entry, index) => (
																	<li key={`${user.uid}-${accountKey}-name-${index}`}>
																		{entry.name}
																		{entry.name && entry.email ? ' ' : ''}
																		{entry.email && (
																			<>
																				&lt;<code>{entry.email}</code>&gt;
																			</>
																		)}
																	</li>
																))}
															</ul>
														)}
													</li>
												);
											})}
										</ul>
									</td>
									<td style={styles.tableCell}>
										<span>{formatTimeSince(user.lastActivityTs)}</span>
										{isInactiveOverMonth(user.lastActivityTs) && (
											<span
												style={styles.inactiveWarning}
												title="No activity for more than one month"
											>
												!
											</span>
										)}
									</td>
									<td style={styles.tableCell}>
										{Number.isInteger(user.failedLoginAttempts)
											? user.failedLoginAttempts
											: '-'}
									</td>
								</tr>
							);
						})}
						{users.length === 0 && (
							<tr>
								<td style={styles.tableCell} colSpan={5}>
									No active accounts found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<h3 style={styles.subheading}>Disabled accounts</h3>
			<div style={styles.tableWrapper}>
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.tableHeader}>UID</th>
						</tr>
					</thead>
					<tbody>
						{disabledUsers.map((user) => (
							<tr key={`disabled-${user.uid}`}>
								<td style={styles.tableCell}>{user.uid}</td>
							</tr>
						))}
						{disabledUsers.length === 0 && (
							<tr>
								<td style={styles.tableCell}>No disabled accounts found.</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function SignatureTemplate() {
	const [template, setTemplate] = useState('');
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		async function loadTemplate() {
			try {
				const data = await apiRequest(
					OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				);
				setTemplate(typeof data.template === 'string' ? data.template : '');
				setStatus('');
			} catch (err) {
				setStatus(
					`Error: ${err instanceof Error ? err.message : 'Failed to load template'}`,
				);
			} finally {
				setLoading(false);
			}
		}

		loadTemplate();
	}, []);

	const saveTemplate = async (event) => {
		event.preventDefault();
		setSaving(true);
		setStatus('Saving template...');
		try {
			const body = new URLSearchParams({ template });
			const data = await apiRequest(
				OC.generateUrl('/apps/hufak/api/settings/signature-template'),
				{
					method: 'POST',
					headers: {
						'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
					},
					body,
				},
			);
			setStatus(data.message || 'Signature template saved');
		} catch (err) {
			setStatus(
				`Error: ${err instanceof Error ? err.message : 'Failed to save template'}`,
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<section style={styles.formSection}>
			<h2>Signature template</h2>
			<form onSubmit={saveTemplate} style={styles.form}>
				<textarea
					value={template}
					onChange={(event) => setTemplate(event.target.value)}
					style={styles.templateBox}
					placeholder="Enter signature template..."
					disabled={loading}
				/>
				<button type="submit" disabled={loading || saving} style={styles.submitButton}>
					{saving ? 'Saving...' : 'Save'}
				</button>
				{status && <p style={styles.successMessage}>{status}</p>}
			</form>
		</section>
	);
}

function AdminPanel({ emailDomain, setEmailDomain }) {
	const [selectedSection, setSelectedSection] = useState(() => parseSectionFromUrl());

	useEffect(() => {
		const handlePopState = () => {
			setSelectedSection(parseSectionFromUrl());
		};

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, []);

	const selectSection = (section) => {
		setSelectedSection(section);
		updateUrlSection(section);
	};

	let content = <Overview />;
	if (selectedSection === SECTION_KEYS.ADD_USER) {
		content = <AddUser emailDomain={emailDomain} />;
	} else if (selectedSection === SECTION_KEYS.CONFIGURE_MAIL) {
		content = <ConfigureMail emailDomain={emailDomain} setEmailDomain={setEmailDomain} />;
	} else if (selectedSection === SECTION_KEYS.MAILBOX_CONFIG) {
		content = <MailboxConfig emailDomain={emailDomain} setEmailDomain={setEmailDomain} />;
	} else if (selectedSection === SECTION_KEYS.CHECK_STATUS) {
		content = <CheckStatus />;
	} else if (selectedSection === SECTION_KEYS.SIGNATURE_TEMPLATE) {
		content = <SignatureTemplate />;
	}

	return (
		<div style={styles.layout}>
			<nav style={styles.menu}>
				{SECTIONS.map((section) => (
					<button
						key={section.key}
						type="button"
						onClick={() => selectSection(section.key)}
						style={{
							...styles.menuItem,
							...(selectedSection === section.key ? styles.menuItemActive : {}),
						}}
					>
						{section.label}
					</button>
				))}
			</nav>
			<main style={styles.content}>{content}</main>
		</div>
	);
}

function App() {
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [emailDomain, setEmailDomain] = useState(DEFAULT_EMAIL_DOMAIN);
	const [error, setError] = useState('');

	useEffect(() => {
		async function load() {
			try {
				const statusData = await apiRequest(OC.generateUrl('/apps/hufak/api/admin-status'));
				const admin = Boolean(statusData.isAdmin);
				setIsAdmin(admin);
				if (admin) {
					const domainData = await apiRequest(
						OC.generateUrl('/apps/hufak/api/settings/email-domain'),
					);
					setEmailDomain(domainData.emailDomain || DEFAULT_EMAIL_DOMAIN);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error');
			} finally {
				setLoading(false);
			}
		}

		load();
	}, []);

	if (loading) {
		return (
			<div style={styles.page}>
				<p>Checking administrator privileges...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div style={styles.page}>
				<p>Failed to check administrator privileges: {error}</p>
			</div>
		);
	}

	return (
		<div style={styles.page}>
			{isAdmin ? (
				<AdminPanel emailDomain={emailDomain} setEmailDomain={setEmailDomain} />
			) : (
				<p>You do not have administrator rights.</p>
			)}
		</div>
	);
}

const styles = {
	page: {
		background: 'var(--color-main-background)',
		minHeight: 'calc(100vh - var(--header-height))',
		width: '100%',
		maxWidth: 'none',
		padding: '20px',
		boxSizing: 'border-box',
		overflow: 'auto',
	},
	layout: {
		display: 'grid',
		gridTemplateColumns: '220px minmax(0, 1fr)',
		gap: '16px',
		alignItems: 'start',
		width: '100%',
		minWidth: 0,
	},
	menu: {
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
	},
	menuItem: {
		textAlign: 'left',
		padding: '10px 12px',
		borderRadius: '8px',
		border: '1px solid var(--color-border)',
		background: 'var(--color-background-hover)',
		color: 'var(--color-main-text)',
		cursor: 'pointer',
		fontSize: '14px',
	},
	menuItemActive: {
		background: 'var(--color-primary-element)',
		color: 'var(--color-primary-element-text)',
		borderColor: 'var(--color-primary-element)',
	},
	content: {
		background: 'var(--color-main-background-translucent)',
		border: '1px solid var(--color-border)',
		borderRadius: '10px',
		padding: '16px',
		minHeight: '220px',
		width: '100%',
		minWidth: 0,
		overflow: 'auto',
	},
	formSection: {
		width: '100%',
	},
	form: {
		display: 'grid',
		gap: '10px',
	},
	fieldLabel: {
		fontWeight: 600,
		fontSize: '14px',
		color: 'var(--color-main-text)',
	},
	input: {
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '10px 12px',
		fontSize: '14px',
		background: 'var(--color-main-background)',
		color: 'var(--color-main-text)',
		width: '100%',
		minWidth: 'min(100%, 320px)',
		maxWidth: '560px',
		boxSizing: 'border-box',
	},
	validationMessage: {
		margin: 0,
		color: 'var(--color-error)',
		fontSize: '13px',
	},
	hintText: {
		margin: 0,
		color: 'var(--color-text-maxcontrast)',
		fontSize: '13px',
	},
	submitButton: {
		marginTop: '6px',
		padding: '10px 12px',
		borderRadius: '8px',
		border: '1px solid var(--color-primary-element)',
		background: 'var(--color-primary-element)',
		color: 'var(--color-primary-element-text)',
		cursor: 'pointer',
		width: 'fit-content',
	},
	successMessage: {
		margin: 0,
		color: 'var(--color-success)',
		fontSize: '13px',
	},
	outputBox: {
		marginTop: '8px',
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '10px 12px',
		fontSize: '13px',
		background: 'var(--color-main-background)',
		color: 'var(--color-main-text)',
		minHeight: '96px',
		minWidth: 'min(100%, 320px)',
		width: '100%',
		maxWidth: '560px',
		boxSizing: 'border-box',
		resize: 'vertical',
	},
	templateBox: {
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '10px 12px',
		fontSize: '13px',
		background: 'var(--color-main-background)',
		color: 'var(--color-main-text)',
		minHeight: '220px',
		minWidth: 'min(100%, 320px)',
		width: '100%',
		boxSizing: 'border-box',
		resize: 'vertical',
	},
	tableWrapper: {
		overflowX: 'auto',
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
	},
	table: {
		width: '100%',
		borderCollapse: 'collapse',
	},
	tableHeader: {
		textAlign: 'left',
		padding: '10px 12px',
		fontSize: '13px',
		borderBottom: '1px solid var(--color-border)',
		background: 'var(--color-background-hover)',
	},
	tableCell: {
		padding: '10px 12px',
		fontSize: '13px',
		borderBottom: '1px solid var(--color-border)',
		verticalAlign: 'top',
	},
	additionalEmailList: {
		margin: '8px 0 0 18px',
		padding: 0,
		fontSize: '12px',
	},
	identityNameList: {
		margin: '6px 0 0 18px',
		padding: 0,
		fontSize: '12px',
	},
	treeContainer: {
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '10px',
		background: 'var(--color-main-background)',
		overflowX: 'auto',
	},
	treeLevel: {
		display: 'grid',
		gap: '8px',
	},
	treeRow: {
		display: 'grid',
		gridTemplateColumns: 'minmax(220px, 1fr) minmax(220px, 1fr)',
		gap: '8px',
	},
	treeKeyInput: {
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '8px 10px',
		fontSize: '13px',
		background: 'var(--color-main-background)',
		color: 'var(--color-main-text)',
		width: '100%',
		boxSizing: 'border-box',
		minWidth: '220px',
	},
	treeValueInput: {
		border: '1px solid var(--color-border)',
		borderRadius: '8px',
		padding: '8px 10px',
		fontSize: '13px',
		background: 'var(--color-main-background)',
		color: 'var(--color-main-text)',
		width: '100%',
		boxSizing: 'border-box',
		minWidth: '220px',
	},
	subheading: {
		margin: '18px 0 8px',
		fontSize: '16px',
		fontWeight: 600,
	},
	inactiveWarning: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '16px',
		height: '16px',
		borderRadius: '50%',
		background: 'var(--color-error)',
		color: 'white',
		fontWeight: 700,
		fontSize: '11px',
		marginLeft: '8px',
		lineHeight: 1,
	},
	overviewList: {
		margin: '8px 0 0 18px',
		padding: 0,
		display: 'grid',
		gap: '8px',
	},
	statusOk: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '20px',
		height: '20px',
		borderRadius: '50%',
		background: 'var(--color-success)',
		color: 'white',
		fontWeight: 700,
		lineHeight: 1,
	},
	statusWarn: {
		display: 'inline-flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: '20px',
		height: '20px',
		borderRadius: '50%',
		background: 'var(--color-warning)',
		color: 'black',
		fontWeight: 700,
		lineHeight: 1,
	},
};

const rootElement = document.getElementById('hufak-root');
if (rootElement) {
	createRoot(rootElement).render(<App />);
}
