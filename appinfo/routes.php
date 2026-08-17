<?php

declare(strict_types=1);

return [
	'routes' => [
		[
			'name' => 'page#index',
			'url' => '/',
			'verb' => 'GET',
		],
		[
			'name' => 'api#adminStatus',
			'url' => '/api/admin-status',
			'verb' => 'GET',
		],
		[
			'name' => 'api#getEmailDomain',
			'url' => '/api/settings/email-domain',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setEmailDomain',
			'url' => '/api/settings/email-domain',
			'verb' => 'POST',
		],
		[
			'name' => 'api#createUser',
			'url' => '/api/accounts',
			'verb' => 'POST',
		],
		[
			'name' => 'api#createKasMailbox',
			'url' => '/api/accounts/{uid}/kas-mailbox',
			'verb' => 'POST',
		],
		[
			'name' => 'api#sendUserWelcomeEmail',
			'url' => '/api/accounts/{uid}/welcome-email',
			'verb' => 'POST',
		],
		[
			'name' => 'api#testKasConnection',
			'url' => '/api/kas/test',
			'verb' => 'POST',
		],
		[
			'name' => 'api#listKasMailAccounts',
			'url' => '/api/kas/mail-accounts',
			'verb' => 'POST',
		],
		[
			'name' => 'api#listKasMailForwards',
			'url' => '/api/kas/mail-forwards',
			'verb' => 'POST',
		],
		[
			'name' => 'api#createTemporaryKasMailbox',
			'url' => '/api/kas/temporary-mailbox',
			'verb' => 'POST',
		],
		[
			'name' => 'api#listKasMailboxAddresses',
			'url' => '/api/kas/mailbox-addresses',
			'verb' => 'GET',
		],
		[
			'name' => 'api#getKasMailServerSettings',
			'url' => '/api/kas/mail-server-settings',
			'verb' => 'GET',
		],
		[
			'name' => 'api#runSnappymailSettings',
			'url' => '/api/snappymail/settings',
			'verb' => 'POST',
		],
		[
			'name' => 'api#deletePrimarySnappymailAccount',
			'url' => '/api/snappymail/settings',
			'verb' => 'DELETE',
		],
		[
			'name' => 'api#deleteAdditionalSnappymailAccount',
			'url' => '/api/snappymail/additional-account',
			'verb' => 'DELETE',
		],
		[
			'name' => 'api#addAdditionalSnappymailAccount',
			'url' => '/api/snappymail/additional-account',
			'verb' => 'POST',
		],
		[
			'name' => 'api#setSnappymailIdentitySignature',
			'url' => '/api/snappymail/identity-signature',
			'verb' => 'POST',
		],
		[
			'name' => 'api#getSignatureTemplate',
			'url' => '/api/settings/signature-template',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setSignatureTemplate',
			'url' => '/api/settings/signature-template',
			'verb' => 'POST',
		],
		[
			'name' => 'api#getNewAccountTemplate',
			'url' => '/api/settings/new-account',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setNewAccountTemplate',
			'url' => '/api/settings/new-account',
			'verb' => 'POST',
		],
		[
			'name' => 'api#listActiveUserStatus',
			'url' => '/api/accounts/status',
			'verb' => 'GET',
		],
		[
			'name' => 'api#listEnabledUids',
			'url' => '/api/accounts/enabled-uids',
			'verb' => 'GET',
		],
		[
			'name' => 'api#getSharedMailboxes',
			'url' => '/api/settings/shared-mailboxes',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setSharedMailboxes',
			'url' => '/api/settings/shared-mailboxes',
			'verb' => 'POST',
		],
		[
			'name' => 'api#getApporder',
			'url' => '/api/settings/apporder',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setApporder',
			'url' => '/api/settings/apporder',
			'verb' => 'POST',
		],
		[
			'name' => 'api#resetUserApporder',
			'url' => '/api/accounts/{uid}/apporder/default',
			'verb' => 'POST',
		],
		[
			'name' => 'api#getDashboardLayout',
			'url' => '/api/settings/dashboard-layout',
			'verb' => 'GET',
		],
		[
			'name' => 'api#setDashboardLayout',
			'url' => '/api/settings/dashboard-layout',
			'verb' => 'POST',
		],
		[
			'name' => 'api#resetUserDashboardLayout',
			'url' => '/api/accounts/{uid}/dashboard-layout/default',
			'verb' => 'POST',
		],
		[
			'name' => 'api#promoteUserDashboardLayout',
			'url' => '/api/accounts/{uid}/dashboard-layout/promote',
			'verb' => 'POST',
		],
		[
			'name' => 'api#createFreescoutUser',
			'url' => '/api/freescout/user',
			'verb' => 'POST',
		],
		[
			'name' => 'api#promoteUserApporder',
			'url' => '/api/accounts/{uid}/apporder/promote',
			'verb' => 'POST',
		],
		[
			'name' => 'api#getStudentStatsAsset',
			'url' => '/api/student-stats/{fileName}',
			'verb' => 'GET',
		],
	],
];
