import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api';
import { formatTimeSince, isInactiveOverMonth } from '../utils/timeUtils';
import { styles } from '../styles';
import { UserEmailAccountsOverview } from './UserEmailAccountsOverview';

function CheckStatus({ onEditMailbox }) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [users, setUsers] = useState([]);
	const [disabledUsers, setDisabledUsers] = useState([]);
	const [hoveredUid, setHoveredUid] = useState('');
	const [resettingUid, setResettingUid] = useState('');

	const loadUserStatus = useCallback(async () => {
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
	}, []);

	useEffect(() => {
		loadUserStatus();
	}, [loadUserStatus]);

	const resetUserApporder = async (uid) => {
		setResettingUid(uid);
		try {
			await apiRequest(
				OC.generateUrl(`/apps/hufak/api/users/${encodeURIComponent(uid)}/apporder/default`),
				{
					method: 'POST',
				},
			);
			await loadUserStatus();
		} catch (err) {
			setError(
				`Failed to reset app order for ${uid}: ${err instanceof Error ? err.message : 'Unknown error'}`,
			);
		} finally {
			setResettingUid('');
		}
	};

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
							<th style={styles.tableHeader}>Email accounts</th>
							<th style={styles.tableHeader}>App order</th>
							<th style={styles.tableHeader}>Last activity</th>
							<th style={styles.tableHeader}>Failed login attempts</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => {
							const isApporderMismatch = !user.apporderMatches;
							return (
								<tr key={user.uid}>
									<td style={styles.tableCell}>{user.uid}</td>
									<td style={{ ...styles.tableCell, ...styles.emailCell }}>
										<button
											type="button"
											onClick={() => onEditMailbox && onEditMailbox(user.uid)}
											style={styles.emailCellEditButton}
											title={`Edit mailbox for ${user.uid}`}
											disabled={!onEditMailbox}
										>
											edit
										</button>
										<UserEmailAccountsOverview user={user} />
									</td>
									<td style={styles.tableCell}>
										<div
											style={styles.statusWithTooltip}
											onMouseEnter={() => setHoveredUid(user.uid)}
											onMouseLeave={() => setHoveredUid('')}
										>
											{user.apporderMatches ? (
												<span role="img" aria-label="app order matches default">
													☑️
												</span>
											) : (
												<>
													<span role="img" aria-label="app order differs from default">
														⚠️
													</span>
													<button
														type="button"
														onClick={() => resetUserApporder(user.uid)}
														disabled={resettingUid === user.uid}
														style={styles.inlineActionButton}
														aria-label="reset app order to default"
														title="Reset to default app order"
													>
														{resettingUid === user.uid ? '🔄' : '🔁'}
													</button>
												</>
											)}
											{isApporderMismatch && hoveredUid === user.uid && (
												<div style={styles.tooltipPanel}>
													<pre style={styles.tooltipPre}>
														{JSON.stringify(user.apporderDiff || {}, null, 2)}
													</pre>
												</div>
											)}
										</div>
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

export { CheckStatus };
