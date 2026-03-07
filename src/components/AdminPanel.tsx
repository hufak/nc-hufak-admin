import { useEffect, useState } from 'react';
import type { Dispatch, ReactElement, SetStateAction } from 'react';
import { AddAccount } from './AddAccount';
import { ConfigureMail } from './ConfigureMail';
import { Overview } from './Overview';
import { AccountOverview } from './AccountOverview';
import { MailboxConfig } from './MailboxConfig';
import { SignatureTemplateDefaults } from './SignatureTemplateDefaults';
import { AppOrderDefaults } from './AppOrderDefaults';
import {
	buildSectionUrl,
	getConfigureMailUidFromUrl,
	parseSectionFromUrl,
	SECTION_GROUPS,
	SECTION_KEYS,
	SECTIONS,
	updateUrlSection,
	type SectionKey,
} from '../constants';
import { styles } from '../styles';

interface AdminPanelProps {
	emailDomain: string
	setEmailDomain: Dispatch<SetStateAction<string>>
}

function AdminPanel({ emailDomain, setEmailDomain }: AdminPanelProps): ReactElement {
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

	const selectSection = (section: SectionKey) => {
		setSelectedSection(section);
		updateUrlSection(section);
		if (section !== SECTION_KEYS.CONFIGURE_MAIL) {
			setConfigureMailUid('');
		}
	};

	const openConfigureMailForUser = (uid: string) => {
		setSelectedSection(SECTION_KEYS.CONFIGURE_MAIL);
		setConfigureMailUid(uid);
		updateUrlSection(SECTION_KEYS.CONFIGURE_MAIL, uid);
	};

	let content = <Overview />;
	if (selectedSection === SECTION_KEYS.ADD_ACCOUNT) {
		content = <AddAccount emailDomain={emailDomain} />;
	} else if (selectedSection === SECTION_KEYS.CONFIGURE_MAIL) {
		content = <ConfigureMail preselectedUid={configureMailUid} />;
	} else if (selectedSection === SECTION_KEYS.MAILBOX_CONFIG) {
		content = <MailboxConfig emailDomain={emailDomain} setEmailDomain={setEmailDomain} />;
	} else if (selectedSection === SECTION_KEYS.ACCOUNT_OVERVIEW) {
		content = <AccountOverview onEditMailbox={openConfigureMailForUser} />;
	} else if (selectedSection === SECTION_KEYS.SIGNATURE_TEMPLATE) {
		content = <SignatureTemplateDefaults />;
	} else if (selectedSection === SECTION_KEYS.APP_ORDER) {
		content = <AppOrderDefaults />;
	}

	return (
		<div className="hufak-admin-shell">
			<nav id="app-navigation" className="app-navigation-administration" aria-label="Sections">
				<ul id="hufak-navigation">
					{SECTION_GROUPS.flatMap((group) => {
						const items = group.items.map((sectionKey) => {
							const section = SECTIONS.find(({ key }) => key === sectionKey);
							if (!section) {
								return null;
							}
							return (
								<li
									key={section.key}
									className={selectedSection === section.key ? 'active' : undefined}
								>
									<a
										href={buildSectionUrl(section.key)}
										onClick={(event) => {
											event.preventDefault();
											selectSection(section.key);
										}}
										aria-current={selectedSection === section.key ? 'page' : undefined}
									>
										<span className={`hufak-navigation-icon icon ${section.iconClass}`} aria-hidden="true" />
										{section.label}
									</a>
								</li>
							);
						});

						if (!('label' in group)) {
							return items;
						}

						return [
							<li key={`group-${group.label}`} className="hufak-navigation-group-label" aria-hidden="true">
								<div className="app-navigation-caption">{group.label}</div>
							</li>,
							...items,
						];
					})}
				</ul>
			</nav>
			<main id="app-content">
				<div className="hufak-admin-content">{content}</div>
			</main>
		</div>
	);
}

export { AdminPanel };
