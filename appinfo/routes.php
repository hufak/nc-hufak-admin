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
			'url' => '/api/users',
			'verb' => 'POST',
		],
		[
			'name' => 'api#runSnappymailSettings',
			'url' => '/api/snappymail/settings',
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
			'name' => 'api#listActiveUserStatus',
			'url' => '/api/users/status',
			'verb' => 'GET',
		],
		[
			'name' => 'api#listEnabledUids',
			'url' => '/api/users/enabled-uids',
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
	],
];
