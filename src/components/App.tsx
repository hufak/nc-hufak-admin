import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { apiRequest } from '../api';
import { DEFAULT_EMAIL_DOMAIN } from '../constants';
import { styles } from '../styles';
import { AdminPanel } from './AdminPanel';
import type { AdminStatusResponse, EmailDomainResponse } from '../types';

function App(): ReactElement {
	const [loading, setLoading] = useState(true);
	const [isAdmin, setIsAdmin] = useState(false);
	const [emailDomain, setEmailDomain] = useState(DEFAULT_EMAIL_DOMAIN);
	const [error, setError] = useState('');

	useEffect(() => {
		async function load() {
			try {
				const statusData = await apiRequest<AdminStatusResponse>(
					OC.generateUrl('/apps/hufak/api/admin-status'),
				);
				const admin = Boolean(statusData.isAdmin);
				setIsAdmin(admin);
				if (admin) {
					const domainData = await apiRequest<EmailDomainResponse>(
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
			<div className="hufak-page" style={styles.page}>
				<p>Checking administrator privileges...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="hufak-page" style={styles.page}>
				<p>Failed to check administrator privileges: {error}</p>
			</div>
		);
	}

	return (
		<div className="hufak-page" style={styles.page}>
			{isAdmin ? (
				<AdminPanel emailDomain={emailDomain} setEmailDomain={setEmailDomain} />
			) : (
				<p>You do not have administrator rights.</p>
			)}
		</div>
	);
}

export { App };
