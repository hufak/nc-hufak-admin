<?php

declare(strict_types=1);

namespace OCA\Hufak\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http;
use OCP\IConfig;
use OCP\Files\File;
use OCP\Files\IAppData;
use OCP\Files\IRootFolder;
use OCP\Files\SimpleFS\ISimpleFolder;
use OCP\IGroupManager;
use OCP\IRequest;
use OCP\IUserManager;
use OCP\IUserSession;
use Symfony\Component\Process\Process;

class ApiController extends Controller {
	private const CONFIG_EMAIL_DOMAIN = 'email_domain';
	private const CONFIG_APPORDER = 'apporder';
	private const CONFIG_SHARED_MAILBOXES = 'shared_mailboxes';
	private const DEFAULT_EMAIL_DOMAIN = 'hufak.net';
	private const APPDATA_FOLDER_SETTINGS = 'settings';
	private const APPDATA_FILE_SIGNATURE_TEMPLATE = 'signature_template.txt';
	private const DEFAULT_SIGNATURE_TEMPLATE_FILE = 'hufak_signature_template.txt';
	private const DEFAULT_APPORDER_FILE = 'hufak_default_apporder.json';
	private const DEFAULT_SHARED_MAILBOXES_FILE = 'hufak_default_shared_mailboxes.json';

	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private IGroupManager $groupManager,
		private IConfig $config,
		private IUserManager $userManager,
		private IAppData $appData,
		private IRootFolder $rootFolder,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	public function adminStatus(): DataResponse {
		return new DataResponse([
			'isAdmin' => $this->currentUserIsAdmin(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getEmailDomain(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		return new DataResponse([
			'emailDomain' => $this->getStoredEmailDomain(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setEmailDomain(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$emailDomain = strtolower(trim((string)$this->request->getParam('emailDomain', '')));
		if ($emailDomain === '' || !preg_match('/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/', $emailDomain)) {
			return new DataResponse([
				'message' => 'Invalid email domain format',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setAppValue($this->appName, self::CONFIG_EMAIL_DOMAIN, $emailDomain);

		return new DataResponse([
			'emailDomain' => $emailDomain,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getSharedMailboxes(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		return new DataResponse([
			'sharedMailboxes' => $this->getConfiguredSharedMailboxes(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setSharedMailboxes(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$raw = (string)$this->request->getParam('sharedMailboxes', '');
		if ($raw === '') {
			return new DataResponse([
				'message' => 'Missing sharedMailboxes payload',
			], Http::STATUS_BAD_REQUEST);
		}

		$decoded = json_decode($raw, true);
		if (!is_array($decoded)) {
			return new DataResponse([
				'message' => 'sharedMailboxes must be a valid JSON object',
			], Http::STATUS_BAD_REQUEST);
		}

		$encoded = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		if ($encoded === false) {
			return new DataResponse([
				'message' => 'Failed to encode sharedMailboxes',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setAppValue($this->appName, self::CONFIG_SHARED_MAILBOXES, $encoded);

		return new DataResponse([
			'message' => 'Shared mailboxes saved',
			'sharedMailboxes' => $decoded,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function createUser(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$fullName = trim((string)$this->request->getParam('fullName', ''));
		$pronoun = trim((string)$this->request->getParam('pronoun', ''));
		$username = strtolower(trim((string)$this->request->getParam('username', '')));
		$email = trim((string)$this->request->getParam('email', ''));

		if (!preg_match('/^([A-Z][A-Za-z]*)( [A-Z][A-Za-z]*)+$/', $fullName)) {
			return new DataResponse([
				'message' => 'Invalid full name format',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			$this->userManager->validateUserId($username, false);
		} catch (\InvalidArgumentException $exception) {
			return new DataResponse([
				'message' => $exception->getMessage(),
			], Http::STATUS_BAD_REQUEST);
		}

		if ($this->userManager->userExists($username)) {
			return new DataResponse([
				'message' => 'Username already exists',
			], Http::STATUS_CONFLICT);
		}

		if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse([
				'message' => 'Invalid email address',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			$password = bin2hex(random_bytes(12));
		} catch (\Throwable) {
			return new DataResponse([
				'message' => 'Failed to generate a random password',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		try {
			$user = $this->userManager->createUser($username, $password);
		} catch (\InvalidArgumentException $exception) {
			return new DataResponse([
				'message' => $exception->getMessage(),
			], Http::STATUS_BAD_REQUEST);
		}

		if ($user === false) {
			return new DataResponse([
				'message' => 'Failed to create user',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		try {
			$user->setDisplayName($fullName);
		} catch (\InvalidArgumentException) {
			// Keep the created user even if profile fields are invalid.
		}

		if (method_exists($user, 'setSystemEMailAddress')) {
			try {
				$user->setSystemEMailAddress($email);
			} catch (\InvalidArgumentException) {
				// Keep the created user even if profile fields are invalid.
			}
		} else {
			$user->setEMailAddress($email);
		}

		if ($pronoun !== '') {
			$this->config->setUserValue($username, $this->appName, 'pronoun', $pronoun);
		}

		return new DataResponse([
			'message' => sprintf('User "%s" created successfully', $username),
			'username' => $username,
			'password' => $password,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function runSnappymailSettings(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim((string)$this->request->getParam('uid', ''));
		$email = trim((string)$this->request->getParam('email', ''));
		$password = (string)$this->request->getParam('password', '');
		if ($uid === '' || $email === '' || $password === '') {
			return new DataResponse([
				'message' => 'Parameters uid, email and password are required',
			], Http::STATUS_BAD_REQUEST);
		}

		if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse([
				'message' => 'Invalid email address',
			], Http::STATUS_BAD_REQUEST);
		}

		$phpBinary = $this->resolveCompatiblePhpBinary();
		if ($phpBinary === null) {
			return new DataResponse([
				'message' => 'No compatible PHP CLI binary (>= 8.1) found for OCC execution',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		try {
			$process = new Process([
				$phpBinary,
				\OC::$SERVERROOT . '/occ',
				'snappymail:settings',
				$uid,
				$email,
				$password,
			], \OC::$SERVERROOT);
			$process->setTimeout(120);
			$process->run();

			$errorOutput = $process->getErrorOutput();
			if ($process->getExitCode() !== 0 && str_contains($errorOutput, 'opcache.file_cache_only')) {
				$opcacheDir = sys_get_temp_dir() . '/hufak-opcache';
				if (!is_dir($opcacheDir) && !mkdir($opcacheDir, 0770, true) && !is_dir($opcacheDir)) {
					return new DataResponse([
						'message' => 'Failed to prepare temporary opcache directory for OCC execution',
						'path' => $opcacheDir,
					], Http::STATUS_INTERNAL_SERVER_ERROR);
				}

				$process = new Process([
					$phpBinary,
					'-d',
					'opcache.file_cache=' . $opcacheDir,
					'-d',
					'opcache.file_cache_only=0',
					'-d',
					'opcache.enable_cli=0',
					\OC::$SERVERROOT . '/occ',
					'snappymail:settings',
					$uid,
					$email,
					$password,
				], \OC::$SERVERROOT);
				$process->setTimeout(120);
				$process->run();
			}
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to execute occ command',
				'error' => $exception->getMessage(),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		$errorOutput = $process->getErrorOutput();
		$hint = null;
		if ($process->getExitCode() !== 0 && str_contains($errorOutput, 'opcache.file_cache_only')) {
			$hint = 'CLI PHP opcache is misconfigured (file_cache_only without file_cache). Tried a fallback with explicit opcache overrides; fix server-wide CLI PHP config if this persists.';
		} elseif ($process->getExitCode() === 64) {
			$hint = 'Exit code 64 indicates invalid command usage. Check snappymail:settings argument format in your installed SnappyMail version.';
		}

		return new DataResponse([
			'exitCode' => $process->getExitCode(),
			'message' => $process->isSuccessful()
				? 'snappymail:settings command finished successfully'
				: 'snappymail:settings command failed',
			'output' => $process->getOutput(),
			'errorOutput' => $errorOutput,
			'hint' => $hint,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getSignatureTemplate(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		try {
			$template = $this->readOrInitializeSignatureTemplate();
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to load signature template',
				'error' => $exception->getMessage(),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'template' => $template,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setSignatureTemplate(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$template = (string)$this->request->getParam('template', '');

		try {
			$settingsFolder = $this->getSettingsFolder();
			if ($settingsFolder->fileExists(self::APPDATA_FILE_SIGNATURE_TEMPLATE)) {
				$file = $settingsFolder->getFile(self::APPDATA_FILE_SIGNATURE_TEMPLATE);
				$file->putContent($template);
			} else {
				$settingsFolder->newFile(self::APPDATA_FILE_SIGNATURE_TEMPLATE, $template);
			}
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to save signature template',
				'error' => $exception->getMessage(),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'message' => 'Signature template saved',
			'template' => $template,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function listActiveUserStatus(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$configuredApporder = $this->getConfiguredApporder();
		$users = [];
		$disabledUsers = [];
		$this->userManager->callForAllUsers(function ($user) use (&$users, &$disabledUsers, $configuredApporder): void {
			$uid = $user->getUID();
			if (!$user->isEnabled()) {
				$disabledUsers[] = [
					'uid' => $uid,
				];
				return;
			}

			$primaryEmail = $this->config->getUserValue(
				$uid,
				'snappymail',
				'snappymail-email',
				'',
			);
			$additionalAccountsLookupError = null;
			$identitiesLookupError = null;
			$additionalAccounts = $this->loadSnappymailStorageJson(
				$primaryEmail,
				'additionalaccounts',
				$additionalAccountsLookupError,
			);
			$identities = $this->loadSnappymailStorageJson(
				$primaryEmail,
				'identities',
				$identitiesLookupError,
			);
			$additionalAccountIdentitiesLookupErrors = [];
			$additionalAccountIdentities = $this->loadAdditionalAccountIdentities(
				$primaryEmail,
				$additionalAccounts,
				$additionalAccountIdentitiesLookupErrors,
			);

			$users[] = [
				'uid' => $uid,
				'accountName' => (string)$user->getDisplayName(),
				'lastActivityTs' => $user->getLastLogin(),
				'failedLoginAttempts' => $this->resolveFailedLoginAttempts($user),
				'primaryEmail' => $primaryEmail,
				'additionalAccounts' => $additionalAccounts,
				'identities' => $identities,
				'additionalAccountsLookupError' => $additionalAccountsLookupError,
				'identitiesLookupError' => $identitiesLookupError,
				'additionalAccountIdentities' => $additionalAccountIdentities,
				'additionalAccountIdentitiesLookupErrors' => $additionalAccountIdentitiesLookupErrors,
				'apporderMatches' => $this->apporderMatchesConfigured($this->config->getUserValue(
					$uid,
					'core',
					'apporder',
					'',
				), $configuredApporder),
			];
		});

		usort($users, static function (array $a, array $b): int {
			return (int)$b['lastActivityTs'] <=> (int)$a['lastActivityTs'];
		});
		usort($disabledUsers, static function (array $a, array $b): int {
			return strcasecmp($a['uid'], $b['uid']);
		});

		return new DataResponse([
			'users' => $users,
			'disabledUsers' => $disabledUsers,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function listEnabledUids(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uids = [];
		$this->userManager->callForAllUsers(function ($user) use (&$uids): void {
			if ($user->isEnabled()) {
				$uids[] = $user->getUID();
			}
		});

		sort($uids, SORT_NATURAL | SORT_FLAG_CASE);

		return new DataResponse([
			'uids' => $uids,
		]);
	}

	private function currentUserIsAdmin(): bool {
		$user = $this->userSession->getUser();
		return $user !== null && $this->groupManager->isAdmin($user->getUID());
	}

	private function getStoredEmailDomain(): string {
		return $this->config->getAppValue($this->appName, self::CONFIG_EMAIL_DOMAIN, self::DEFAULT_EMAIL_DOMAIN);
	}

	private function getConfiguredApporder(): string {
		$current = $this->config->getAppValue($this->appName, self::CONFIG_APPORDER, '');
		if ($current !== '') {
			return $current;
		}

		$defaultPath = dirname(__DIR__, 2) . '/' . self::DEFAULT_APPORDER_FILE;
		if (!is_readable($defaultPath)) {
			return '';
		}

		$content = file_get_contents($defaultPath);
		if ($content === false || trim($content) === '') {
			return '';
		}

		$this->config->setAppValue($this->appName, self::CONFIG_APPORDER, $content);
		return $content;
	}

	private function getConfiguredSharedMailboxes(): array {
		$current = $this->config->getAppValue($this->appName, self::CONFIG_SHARED_MAILBOXES, '');
		if ($current !== '') {
			$decoded = json_decode($current, true);
			if (is_array($decoded)) {
				return $decoded;
			}
		}

		$defaultPath = dirname(__DIR__, 2) . '/' . self::DEFAULT_SHARED_MAILBOXES_FILE;
		if (!is_readable($defaultPath)) {
			return [];
		}

		$content = file_get_contents($defaultPath);
		if ($content === false || trim($content) === '') {
			return [];
		}

		$decoded = json_decode($content, true);
		if (!is_array($decoded)) {
			return [];
		}

		$encoded = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
		if ($encoded !== false) {
			$this->config->setAppValue($this->appName, self::CONFIG_SHARED_MAILBOXES, $encoded);
		}

		return $decoded;
	}

	private function apporderMatchesConfigured(string $userApporder, string $configuredApporder): bool {
		$userTrimmed = trim($userApporder);
		$configTrimmed = trim($configuredApporder);
		if ($userTrimmed === '' || $configTrimmed === '') {
			return false;
		}

		$userDecoded = json_decode($userTrimmed, true);
		$configDecoded = json_decode($configTrimmed, true);
		if (is_array($userDecoded) && is_array($configDecoded)) {
			return $userDecoded == $configDecoded;
		}

		return $userTrimmed === $configTrimmed;
	}

	private function loadSnappymailStorageJson(
		string $primaryEmail,
		string $fileName,
		?string &$error = null,
	): ?array {
		$email = trim($primaryEmail);
		if ($email === '' || !str_contains($email, '@')) {
			return null;
		}

		[$prefix, $domain] = explode('@', $email, 2);
		$prefix = trim($prefix);
		$domain = strtolower(trim($domain));
		if ($prefix === '' || $domain === '') {
			return null;
		}

		$candidatePaths = [
			'appdata_snappymail/_data_/_default_/storage/' . $domain . '/' . $prefix . '/' . $fileName,
		];

		try {
			$path = null;
			foreach ($candidatePaths as $candidatePath) {
				if ($this->rootFolder->nodeExists($candidatePath)) {
					$path = $candidatePath;
					break;
				}
			}

			if ($path === null) {
				$error = sprintf('Path does not exist: %s', $candidatePaths[0]);
				return null;
			}
			$file = $this->rootFolder->get($path);
			if (!$file instanceof File) {
				return null;
			}
			$content = (string)$file->getContent();
			if (trim($content) === '') {
				return null;
			}
			$decoded = json_decode($content, true);
			return is_array($decoded) ? $decoded : null;
		} catch (\Throwable $exception) {
			$error = sprintf('Failed to load %s: %s', $path, $exception->getMessage());
			return null;
		}
	}

	private function loadAdditionalAccountIdentities(
		string $primaryEmail,
		?array $additionalAccounts,
		array &$lookupErrors,
	): array {
		if (!is_array($additionalAccounts) || $additionalAccounts === []) {
			return [];
		}

		$email = trim($primaryEmail);
		if ($email === '' || !str_contains($email, '@')) {
			return [];
		}

		[$prefix, $domain] = explode('@', $email, 2);
		$prefix = trim($prefix);
		$domain = strtolower(trim($domain));
		if ($prefix === '' || $domain === '') {
			return [];
		}

		$results = [];
		foreach ($additionalAccounts as $additionalAccount => $_accountConfig) {
			if (!is_string($additionalAccount) || trim($additionalAccount) === '') {
				continue;
			}

			$path = 'appdata_snappymail/_data_/_default_/storage/'
				. $domain . '/'
				. $prefix . '/'
				. trim($additionalAccount) . '/'
				. 'identities';
			try {
				if (!$this->rootFolder->nodeExists($path)) {
					$lookupErrors[$additionalAccount] = sprintf('Path does not exist: %s', $path);
					continue;
				}
				$file = $this->rootFolder->get($path);
				if (!$file instanceof File) {
					$lookupErrors[$additionalAccount] = sprintf('Path is not a file: %s', $path);
					continue;
				}
				$content = (string)$file->getContent();
				if (trim($content) === '') {
					continue;
				}
				$decoded = json_decode($content, true);
				if (is_array($decoded)) {
					$results[$additionalAccount] = $decoded;
				} else {
					$lookupErrors[$additionalAccount] = sprintf('Invalid JSON in: %s', $path);
				}
			} catch (\Throwable $exception) {
				$lookupErrors[$additionalAccount] = sprintf(
					'Failed to load %s: %s',
					$path,
					$exception->getMessage(),
				);
			}
		}

		return $results;
	}

	private function resolveFailedLoginAttempts($user): ?int {
		try {
			if (is_object($user) && method_exists($user, 'getFailedLoginAttempts')) {
				$value = $user->getFailedLoginAttempts();
				return is_numeric($value) ? (int)$value : null;
			}
		} catch (\Throwable) {
			// Try fallback below.
		}

		try {
			$uid = is_object($user) && method_exists($user, 'getUID') ? $user->getUID() : null;
			if (is_string($uid) && $uid !== '') {
				$fallback = $this->config->getUserValue($uid, 'password_policy', 'failedLoginAttempts', '');
				if ($fallback !== '' && is_numeric($fallback)) {
					return (int)$fallback;
				}
			}
		} catch (\Throwable) {
			// Ignore fallback failures.
		}

		return null;
	}

	private function resolveCompatiblePhpBinary(): ?string {
		$candidates = [
			'/usr/bin/php',
			'/usr/local/bin/php',
			'/usr/bin/php82',
			'/usr/local/bin/php82',
			'php82',
			'php8.2',
			'php',
		];

		foreach ($candidates as $candidate) {
			try {
				$probe = new Process([$candidate, '-r', 'echo PHP_VERSION;'], \OC::$SERVERROOT);
				$probe->setTimeout(10);
				$probe->run();
				if (!$probe->isSuccessful()) {
					continue;
				}

				$version = trim($probe->getOutput());
				if ($version !== '' && version_compare($version, '8.1.0', '>=')) {
					return $candidate;
				}
			} catch (\Throwable) {
				// Try next candidate.
			}
		}

		return null;
	}

	private function readOrInitializeSignatureTemplate(): string {
		$settingsFolder = $this->getSettingsFolder();
		if ($settingsFolder->fileExists(self::APPDATA_FILE_SIGNATURE_TEMPLATE)) {
			return $settingsFolder->getFile(self::APPDATA_FILE_SIGNATURE_TEMPLATE)->getContent();
		}

		$defaultTemplatePath = dirname(__DIR__, 2) . '/' . self::DEFAULT_SIGNATURE_TEMPLATE_FILE;
		$defaultTemplate = '';
		if (is_readable($defaultTemplatePath)) {
			$content = file_get_contents($defaultTemplatePath);
			if ($content !== false) {
				$defaultTemplate = $content;
			}
		}

		$settingsFolder->newFile(self::APPDATA_FILE_SIGNATURE_TEMPLATE, $defaultTemplate);
		return $defaultTemplate;
	}

	private function getSettingsFolder(): ISimpleFolder {
		try {
			return $this->appData->getFolder(self::APPDATA_FOLDER_SETTINGS);
		} catch (\Throwable) {
			return $this->appData->newFolder(self::APPDATA_FOLDER_SETTINGS);
		}
	}
}
