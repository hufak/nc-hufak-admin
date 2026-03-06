const SECTION_KEYS = {
	OVERVIEW: 'overview',
	ADD_USER: 'add-user',
	CONFIGURE_MAIL: 'configure-mail',
	MAILBOX_CONFIG: 'mailbox-config',
	CHECK_STATUS: 'user-overview',
	SIGNATURE_TEMPLATE: 'signature-template',
};

const VALID_SECTION_KEYS = Object.values(SECTION_KEYS);

const SECTIONS = [
	{ key: SECTION_KEYS.OVERVIEW, label: 'overview' },
	{ key: SECTION_KEYS.CHECK_STATUS, label: 'user overview' },
	{ key: SECTION_KEYS.ADD_USER, label: 'create new user' },
	{ key: SECTION_KEYS.MAILBOX_CONFIG, label: 'shared mailboxes' },
	{ key: SECTION_KEYS.SIGNATURE_TEMPLATE, label: 'global defaults' },
];

function parseSectionFromUrl() {
	const params = new URLSearchParams(window.location.search);
	const requested = params.get('section');
	return VALID_SECTION_KEYS.includes(requested)
		? requested
		: SECTION_KEYS.OVERVIEW;
}

function getConfigureMailUidFromUrl() {
	const params = new URLSearchParams(window.location.search);
	return params.get('uid') || '';
}

function updateUrlSection(section, uid) {
	const url = new URL(window.location.href);
	url.searchParams.set('section', section);
	if (typeof uid === 'string' && uid !== '') {
		url.searchParams.set('uid', uid);
	} else {
		url.searchParams.delete('uid');
	}
	window.history.pushState({}, '', url.toString());
}

const DEFAULT_EMAIL_DOMAIN = 'hufak.net';

export {
	SECTION_KEYS,
	VALID_SECTION_KEYS,
	SECTIONS,
	parseSectionFromUrl,
	getConfigureMailUidFromUrl,
	updateUrlSection,
	DEFAULT_EMAIL_DOMAIN,
};
