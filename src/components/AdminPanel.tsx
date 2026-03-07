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

// Matches nextcloud-vue src/assets/variables.scss ($breakpoint-mobile)
const MOBILE_BREAKPOINT = 1024;
const MDI_MENU = 'M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z';
const MDI_MENU_OPEN = 'M21,15.61L19.59,17L14.58,12L19.59,7L21,8.39L17.44,12L21,15.61M3,6H16V8H3V6M3,13V11H13V13H3M3,18V16H16V18H3Z';

function AdminPanel({ emailDomain, setEmailDomain }: AdminPanelProps): ReactElement {
	const [selectedSection, setSelectedSection] = useState(() => parseSectionFromUrl());
	const [configureMailUid, setConfigureMailUid] = useState(() =>
		getConfigureMailUidFromUrl(),
	);
	const [isNavigationOpen, setIsNavigationOpen] = useState(() => window.innerWidth > MOBILE_BREAKPOINT);

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

	useEffect(() => {
		const handleResize = () => {
			setIsNavigationOpen(window.innerWidth > MOBILE_BREAKPOINT);
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	const selectSection = (section: SectionKey) => {
		setSelectedSection(section);
		updateUrlSection(section);
		if (window.innerWidth <= MOBILE_BREAKPOINT) {
			setIsNavigationOpen(false);
		}
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
			<div
				className={`app-navigation${isNavigationOpen ? '' : ' app-navigation--closed'}`}
				data-v-d5ce90cd=""
			>
				<nav
					id="app-navigation-vue"
					className="app-navigation__content"
					aria-hidden={isNavigationOpen ? 'false' : 'true'}
					aria-label="Sections"
					inert={!isNavigationOpen || undefined}
					data-v-d5ce90cd=""
					onKeyDown={(event) => {
						if (event.key === 'Escape' && window.innerWidth <= MOBILE_BREAKPOINT && isNavigationOpen) {
							setIsNavigationOpen(false);
						}
					}}
				>
					<ul id="hufak-navigation" data-v-d5ce90cd="">
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
				<div className="app-navigation-toggle-wrapper" data-v-5a15295d="">
					<button
						type="button"
						className="button-vue button-vue--size-normal button-vue--tertiary app-navigation-toggle"
						aria-controls="app-navigation-vue"
						aria-expanded={isNavigationOpen ? 'true' : 'false'}
						aria-keyshortcuts="n"
						aria-label={isNavigationOpen ? 'Close navigation' : 'Open navigation'}
						title={isNavigationOpen ? 'Close navigation' : 'Open navigation'}
						data-v-5a15295d=""
						data-v-06ad9b25=""
						onClick={() => setIsNavigationOpen((open) => !open)}
					>
						<span className="button-vue__wrapper" data-v-06ad9b25="">
							<span className="button-vue__icon" aria-hidden="true" data-v-06ad9b25="">
								<svg
									className="hufak-toggle-icon"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path d={isNavigationOpen ? MDI_MENU_OPEN : MDI_MENU} />
								</svg>
							</span>
							<span className="button-vue__text" data-v-06ad9b25="" />
						</span>
					</button>
				</div>
			</div>
			<main id="app-content-vue" className="app-content">
				<div className="hufak-admin-content">{content}</div>
			</main>
		</div>
	);
}

export { AdminPanel };
