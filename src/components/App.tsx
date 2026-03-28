import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { apiRequest } from '../api';
import { DEFAULT_EMAIL_DOMAIN } from '../constants';
import { styles } from '../styles';
import { AdminPanel } from './AdminPanel';
import type { AdminStatusResponse, EmailDomainResponse } from '../types';

type AdminStatus = 'unknown' | 'admin' | 'non-admin'

function App(): ReactElement {
	const [adminStatus, setAdminStatus] = useState<AdminStatus>('unknown');
	const [emailDomain, setEmailDomain] = useState(DEFAULT_EMAIL_DOMAIN);
	const [error, setError] = useState('');

	useEffect(() => {
		async function load() {
			try {
				const statusData = await apiRequest<AdminStatusResponse>(
					OC.generateUrl('/apps/hufak/api/admin-status'),
				);
				const admin = Boolean(statusData.isAdmin);
				setAdminStatus(admin ? 'admin' : 'non-admin');
				if (admin) {
					const domainData = await apiRequest<EmailDomainResponse>(
						OC.generateUrl('/apps/hufak/api/settings/email-domain'),
					);
					setEmailDomain(domainData.emailDomain || DEFAULT_EMAIL_DOMAIN);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error');
			}
		}

		load();
	}, []);

	return (
		<div className="hufak-page" style={styles.page}>
			<AdminPanel
				adminStatus={adminStatus}
				adminStatusError={error}
				emailDomain={emailDomain}
				setEmailDomain={setEmailDomain}
			/>
		</div>
	);
}

export { App };
