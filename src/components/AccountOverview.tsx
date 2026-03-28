import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { apiRequest } from '../api';
import { formatTimeSince, isInactiveOverMonth } from '../utils/timeUtils';
import { styles } from '../styles';
import { AccountEmailAccountsOverview } from './AccountEmailAccountsOverview';
import type { DisabledUser, MailboxUser, UserStatusResponse } from '../types';

interface AccountOverviewProps {
	onEditMailbox?: (uid: string) => void
}

function AccountOverview({ onEditMailbox }: AccountOverviewProps): ReactElement {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [users, setUsers] = useState<MailboxUser[]>([]);
	const [disabledUsers, setDisabledUsers] = useState<DisabledUser[]>([]);
	const [hoveredUid, setHoveredUid] = useState('');
	const [resettingUid, setResettingUid] = useState('');

	const loadUserStatus = useCallback(async () => {
		try {
			const data = await apiRequest<UserStatusResponse>(
				OC.generateUrl('/apps/hufak/api/accounts/status'),
			);
			const nextUsers = Array.isArray(data.users) ? data.users : [];
			nextUsers.forEach((user) => {
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

	const resetUserApporder = async (uid: string) => {
		setResettingUid(uid);
		try {
			await apiRequest(
				OC.generateUrl(`/apps/hufak/api/accounts/${encodeURIComponent(uid)}/apporder/default`),
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
				<div style={styles.proseContent}>
					<h2>Account overview</h2>
					<p>Loading account status...</p>
				</div>
			</section>
		);
	}

	if (error) {
		return (
			<section style={styles.formSection}>
				<div style={styles.proseContent}>
					<h2>Account overview</h2>
					<p style={styles.validationMessage}>Failed to load status: {error}</p>
				</div>
			</section>
		);
	}

	return (
		<section style={styles.fullWidthSection}>
			<div style={styles.proseSectionContent}>
				<h2>Account overview</h2>
				<p style={styles.introText}>
					Hufak-specific Nextcloud account and Snappymail email settings overview and
					quick-edit. For all other Nextcloud account management tasks, see{' '}
					<a href={OC.generateUrl('/settings/users')} style={styles.inlineLink}>
						here
					</a>
					.
				</p>
			</div>
			<div style={styles.tableWrapper}>
				<table style={styles.table}>
					<thead>
						<tr>
							<th style={styles.tableHeader}>UID</th>
							<th style={styles.tableHeader}>Primary & additional email accounts</th>
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
										<div style={styles.emailCellLayout}>
											<div style={styles.emailCellContent}>
												<AccountEmailAccountsOverview user={user} />
											</div>
											{onEditMailbox ? (
												<button
													type="button"
													onClick={() => onEditMailbox(user.uid)}
													style={styles.emailCellEditButton}
													title={`edit Snappymail accounts for user ${user.uid}`}
													aria-label={`edit Snappymail accounts for user ${user.uid}`}
												>
													<span
														className="icon icon-rename"
														aria-hidden="true"
														style={styles.squareIcon}
													/>
												</button>
											) : null}
										</div>
									</td>
									<td style={styles.tableCell}>
										<div
											style={styles.statusWithTooltip}
											onMouseEnter={() => setHoveredUid(user.uid)}
											onMouseLeave={() => setHoveredUid('')}
										>
											{user.apporderMatches ? (
												<span className="icon icon-checkmark" aria-label="app order matches default">
													
												</span>
											) : (
												<>
													<span className="icon icon-error" aria-label="app order differs from default">
														
													</span>
													<button
														type="button"
														onClick={() => resetUserApporder(user.uid)}
														disabled={resettingUid === user.uid}
														style={styles.inlineActionButton}
														aria-label="reset app order to default"
														title="Reset to default app order"
													>
														<span
															className={`icon ${resettingUid === user.uid ? 'icon-loading-small' : 'icon-history'}`}
															aria-hidden="true"
															style={styles.squareIcon}
														/>
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
										{user.lastActivityTs !== null &&
										user.lastActivityTs !== undefined &&
										Number(user.lastActivityTs) > 0 &&
										isInactiveOverMonth(user.lastActivityTs) && (
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
			<div style={styles.proseSectionContent}>
				<h3 style={styles.subheading}>Disabled accounts</h3>
			</div>
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

export { AccountOverview };
