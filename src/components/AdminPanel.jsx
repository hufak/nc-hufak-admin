import React, { useEffect, useState } from 'react';
import { AddUser } from './AddUser';
import { ConfigureMail } from './ConfigureMail';
import { Overview } from './Overview';
import { CheckStatus } from './CheckStatus';
import { MailboxConfig } from './MailboxConfig';
import { GlobalDefaults } from './GlobalDefaults';
import {
	getConfigureMailUidFromUrl,
	parseSectionFromUrl,
	SECTION_KEYS,
	updateUrlSection,
	SECTIONS,
} from '../constants';
import { styles } from '../styles';

function AdminPanel({ emailDomain, setEmailDomain }) {
	const [selectedSection, setSelectedSection] = useState(() => parseSectionFromUrl());
	const [configureMailUid, setConfigureMailUid] = useState(() =>
		getConfigureMailUidFromUrl(),
	);

	useEffect(() => {
		const handlePopState = () => {
			setSelectedSection(parseSectionFromUrl());
			setConfigureMailUid(getConfigureMailUidFromUrl());
		};

		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('popstate', handlePopState);
		};
	}, []);

	const selectSection = (section) => {
		setSelectedSection(section);
		updateUrlSection(section);
		if (section !== SECTION_KEYS.CONFIGURE_MAIL) {
			setConfigureMailUid('');
		}
	};

	const openConfigureMailForUser = (uid) => {
		setSelectedSection(SECTION_KEYS.CONFIGURE_MAIL);
		setConfigureMailUid(uid);
		updateUrlSection(SECTION_KEYS.CONFIGURE_MAIL, uid);
	};

	let content = <Overview />;
	if (selectedSection === SECTION_KEYS.ADD_USER) {
		content = <AddUser emailDomain={emailDomain} />;
	} else if (selectedSection === SECTION_KEYS.CONFIGURE_MAIL) {
		content = <ConfigureMail preselectedUid={configureMailUid} />;
	} else if (selectedSection === SECTION_KEYS.MAILBOX_CONFIG) {
		content = <MailboxConfig emailDomain={emailDomain} setEmailDomain={setEmailDomain} />;
	} else if (selectedSection === SECTION_KEYS.CHECK_STATUS) {
		content = <CheckStatus onEditMailbox={openConfigureMailForUser} />;
	} else if (selectedSection === SECTION_KEYS.SIGNATURE_TEMPLATE) {
		content = <GlobalDefaults />;
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

export { AdminPanel };
