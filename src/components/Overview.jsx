import React from 'react';
import { styles } from '../styles';

function Overview() {
	return (
		<section style={styles.formSection}>
			<h2>Overview</h2>
			<ul style={styles.overviewList}>
				<li>
					<strong>overview</strong>: quick description of all tabs and their purpose.
				</li>
				<li>
					<strong>create new user</strong>: create a Nextcloud user, generate credentials, and see
					creation status output.
				</li>
				<li>
					<strong>configure mail</strong>: set a user's primary SnappyMail account.
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
					<strong>global defaults</strong>: edit global signature template and global
					Nextcloud app order defaults.
				</li>
			</ul>
			</section>
	);
}

export { Overview };
