<?php

declare(strict_types=1);

namespace OCA\Hufak\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\DataResponse;
use OCP\AppFramework\Http\DataDisplayResponse;
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
use OCA\Hufak\Service\KasMailClient;
use Symfony\Component\Process\Process;

class ApiController extends Controller {
	private const CONFIG_EMAIL_DOMAIN = 'email_domain';
	private const CONFIG_APPORDER = 'apporder';
	private const CONFIG_SHARED_MAILBOXES = 'shared_mailboxes';
	private const CONFIG_DASHBOARD_LAYOUT = 'dashboard_layout';
	private const CONFIG_NEW_ACCOUNT_TEMPLATE = 'new_account_information_template';
	private const SNAPPYMAIL_USER_CONFIG_APP = 'nextsnapmail';
	private const SNAPPYMAIL_USER_CONFIG_EMAIL = 'nextsnapmail-email';
	private const SNAPPYMAIL_OCC_COMMAND = 'nextsnapmail:settings';
	private const SNAPPYMAIL_STORAGE_ROOT = 'appdata_nextsnapmail/_data_/_default_/storage/';
	private const CONFIG_FREESCOUT_PATH = 'freescout_path';
	private const DEFAULT_FREESCOUT_PATH = '../ticket.hufak.net/freescout-dist';
	private const DEFAULT_EMAIL_DOMAIN = 'hufak.net';
	private const APPDATA_FOLDER_SETTINGS = 'settings';
	private const APPDATA_FILE_SIGNATURE_TEMPLATE = 'signature_template.txt';
	private const DEFAULT_SIGNATURE_TEMPLATE_FILE = 'hufak_signature_template.txt';
	private const DEFAULT_NEW_ACCOUNT_TEMPLATE_FILE = 'hufak_default_new_account_information_sheet.md';
	private const DEFAULT_APPORDER_FILE = 'hufak_default_apporder.json';
	private const DEFAULT_SHARED_MAILBOXES_FILE = 'hufak_default_shared_mailboxes.json';
	private const STUDENT_STATS_PUBLIC_DIR = 'studentstats2025/public';
	private const STUDENT_STATS_ALLOWED_FILES = [
		'counts_binary_gender_by_studium.csv' => 'text/csv; charset=utf-8',
		'counts_fee_status_by_studium.csv' => 'text/csv; charset=utf-8',
		'counts_region_by_studium.csv' => 'text/csv; charset=utf-8',
		'counts_by_country.csv' => 'text/csv; charset=utf-8',
		'countries.csv' => 'text/csv; charset=utf-8',
		'studies.csv' => 'text/csv; charset=utf-8',
		'totals.json' => 'application/json; charset=utf-8',
	];

	public function __construct(
		string $appName,
		IRequest $request,
		private IUserSession $userSession,
		private IGroupManager $groupManager,
		private IConfig $config,
		private IUserManager $userManager,
		private IAppData $appData,
		private IRootFolder $rootFolder,
		private KasMailClient $kasMailClient,
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
	 * @NoCSRFRequired
	 */
	public function getStudentStatsAsset(string $fileName): DataDisplayResponse|DataResponse {
		$fileName = trim($fileName);
		$contentType = self::STUDENT_STATS_ALLOWED_FILES[$fileName] ?? null;
		if ($contentType === null) {
			return new DataResponse([
				'message' => 'Unknown student stats asset',
			], Http::STATUS_NOT_FOUND);
		}

		$assetPath = dirname(__DIR__, 2) . '/' . self::STUDENT_STATS_PUBLIC_DIR . '/' . $fileName;
		if (!is_file($assetPath) || !is_readable($assetPath)) {
			return new DataResponse([
				'message' => 'Student stats asset not found',
			], Http::STATUS_NOT_FOUND);
		}

		$content = file_get_contents($assetPath);
		if ($content === false) {
			return new DataResponse([
				'message' => 'Failed to read student stats asset',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		$response = new DataDisplayResponse($content);
		$response->addHeader('Content-Type', $contentType);
		$response->cacheFor(300, false, false);
		return $response;
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
	public function getApporder(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		return new DataResponse([
			'apporder' => $this->getConfiguredApporder(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setApporder(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$apporder = (string)$this->request->getParam('apporder', '');
		if (trim($apporder) === '') {
			return new DataResponse([
				'message' => 'Missing apporder payload',
			], Http::STATUS_BAD_REQUEST);
		}

		$decoded = json_decode($apporder, true);
		if (!is_array($decoded)) {
			return new DataResponse([
				'message' => 'Apporder must be valid JSON object data',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setAppValue($this->appName, self::CONFIG_APPORDER, $apporder);

		return new DataResponse([
			'message' => 'Apporder saved',
			'apporder' => $apporder,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function getDashboardLayout(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		return new DataResponse([
			'dashboardLayout' => $this->getConfiguredDashboardLayout(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setDashboardLayout(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$layout = $this->normalizeDashboardLayout(
			(string)$this->request->getParam('dashboardLayout', ''),
		);
		if ($layout === '') {
			return new DataResponse([
				'message' => 'Missing dashboard widget layout payload',
			], Http::STATUS_BAD_REQUEST);
		}

		foreach (explode(',', $layout) as $widgetId) {
			if (!preg_match('/^[A-Za-z0-9_.\\-]+$/', $widgetId)) {
				return new DataResponse([
					'message' => sprintf('Invalid widget id "%s"', $widgetId),
				], Http::STATUS_BAD_REQUEST);
			}
		}

		$this->config->setAppValue($this->appName, self::CONFIG_DASHBOARD_LAYOUT, $layout);

		return new DataResponse([
			'message' => 'Dashboard widgets saved',
			'dashboardLayout' => $layout,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function resetUserDashboardLayout(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim($uid);
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}

		$layout = $this->getConfiguredDashboardLayout();
		if ($layout === '') {
			// nothing configured yet, so there is no drift to correct either
			return new DataResponse([
				'message' => 'No default dashboard widgets configured, nothing to apply',
				'uid' => $uid,
			]);
		}

		$this->config->setUserValue($uid, 'dashboard', 'layout', $layout);

		return new DataResponse([
			'message' => 'User dashboard widgets reset to defaults',
			'uid' => $uid,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function promoteUserDashboardLayout(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim($uid);
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}

		$userLayout = $this->normalizeDashboardLayout(
			$this->config->getUserValue($uid, 'dashboard', 'layout', ''),
		);
		if ($userLayout === '') {
			return new DataResponse([
				'message' => 'User dashboard widget layout is empty',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setAppValue($this->appName, self::CONFIG_DASHBOARD_LAYOUT, $userLayout);

		return new DataResponse([
			'message' => 'Default dashboard widgets updated from user layout',
			'uid' => $uid,
			'dashboardLayout' => $userLayout,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function resetUserApporder(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim($uid);
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}

		$apporder = $this->getConfiguredApporder();
		if (trim($apporder) === '') {
			return new DataResponse([
				'message' => 'Hufak apporder is empty',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setUserValue($uid, 'core', 'apporder', $apporder);

		return new DataResponse([
			'message' => 'User apporder reset to defaults',
			'uid' => $uid,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function createFreescoutUser(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$email = trim((string)$this->request->getParam('email', ''));
		$fullName = trim((string)$this->request->getParam('fullName', ''));
		if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse([
				'message' => 'Invalid email address',
			], Http::STATUS_BAD_REQUEST);
		}

		// the module matches FreeScout users by sanitized (lowercased) email
		$email = strtolower($email);
		$nameParts = preg_split('/\s+/', $fullName, 2) ?: [];
		$firstName = trim((string)($nameParts[0] ?? ''));
		$lastName = trim((string)($nameParts[1] ?? ''));
		if ($firstName === '') {
			return new DataResponse([
				'message' => 'A full name is required to create a FreeScout user',
			], Http::STATUS_BAD_REQUEST);
		}
		if ($lastName === '') {
			// FreeScout requires a last name, the OAuth module uses the same fallback
			$lastName = 'User';
		}

		$freescoutRoot = $this->resolveFreescoutRoot();
		if ($freescoutRoot === null) {
			return new DataResponse([
				'message' => sprintf(
					'FreeScout installation not found at "%s" (set it with: occ config:app:set %s %s --value=<path>)',
					$this->getConfiguredFreescoutPath(),
					$this->appName,
					self::CONFIG_FREESCOUT_PATH,
				),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		$phpBinary = $this->resolveCompatiblePhpBinary();
		if ($phpBinary === null) {
			return new DataResponse([
				'message' => 'No compatible PHP CLI binary (>= 8.1) found for artisan execution',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		try {
			// the account signs in through the OAuth module, so this password is
			// never handed out - it only satisfies the command's requirements
			$password = bin2hex(random_bytes(16));
		} catch (\Throwable) {
			return new DataResponse([
				'message' => 'Failed to generate a random password',
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		try {
			$process = new Process([
				$phpBinary,
				$freescoutRoot . '/artisan',
				'freescout:create-user',
				'--role=user',
				'--firstName=' . $firstName,
				'--lastName=' . $lastName,
				'--email=' . $email,
				'--password=' . $password,
				'--no-interaction',
			], $freescoutRoot);
			$process->setTimeout(120);
			$process->run();
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to execute artisan command',
				'error' => $exception->getMessage(),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'message' => $process->isSuccessful()
				? sprintf('FreeScout user "%s" created', $email)
				: 'FreeScout user creation failed',
			'email' => $email,
			'freescoutRoot' => $freescoutRoot,
			'exitCode' => $process->getExitCode(),
			'output' => $process->getOutput(),
			'errorOutput' => $process->getErrorOutput(),
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function promoteUserApporder(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim($uid);
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}

		$userApporder = trim($this->config->getUserValue($uid, 'core', 'apporder', ''));
		if ($userApporder === '') {
			return new DataResponse([
				'message' => 'User apporder is empty',
			], Http::STATUS_BAD_REQUEST);
		}

		$decoded = json_decode($userApporder, true);
		if (!is_array($decoded)) {
			return new DataResponse([
				'message' => 'User apporder is not valid JSON object data',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->setAppValue($this->appName, self::CONFIG_APPORDER, $userApporder);

		return new DataResponse([
			'message' => 'Default apporder updated from user apporder',
			'uid' => $uid,
			'apporder' => $userApporder,
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
		$sendWelcomeEmail = trim((string)$this->request->getParam('sendWelcomeEmail', '')) === '1';
		$deferWelcomeEmail = trim((string)$this->request->getParam('deferWelcomeEmail', '')) === '1';

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

		if ($sendWelcomeEmail && !$deferWelcomeEmail) {
			$mailError = null;
			try {
				$mailHelper = \OCP\Server::get(\OCA\Settings\Mailer\NewUserMailHelper::class);
				// true: include a password reset token, so the account holder sets
				// their own password instead of us mailing the generated one
				$mailHelper->sendMail($user, $mailHelper->generateTemplate($user, true));
			} catch (\Throwable $exception) {
				$mailError = $exception->getMessage();
			}

			if ($mailError === null) {
				return new DataResponse([
					'message' => sprintf(
						'User "%s" created successfully, welcome email sent to %s',
						$username,
						$email,
					),
					'username' => $username,
					'welcomeEmailSent' => true,
				]);
			}

			// keep the account, but fall back to handing out the generated password
			return new DataResponse([
				'message' => sprintf(
					'User "%s" created successfully, but sending the welcome email to %s failed: %s',
					$username,
					$email,
					$mailError,
				),
				'username' => $username,
				'password' => $password,
				'welcomeEmailSent' => false,
				'welcomeEmailError' => $mailError,
			]);
		}

		if ($sendWelcomeEmail) {
			return new DataResponse([
				'message' => sprintf('User "%s" created successfully; welcome email is deferred', $username),
				'username' => $username,
				'welcomeEmailSent' => false,
				'welcomeEmailDeferred' => true,
			]);
		}

		return new DataResponse([
			'message' => sprintf('User "%s" created successfully', $username),
			'username' => $username,
			'password' => $password,
			'welcomeEmailSent' => false,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function createKasMailbox(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse(['message' => 'Admin permissions required'], Http::STATUS_FORBIDDEN);
		}

		$uid = trim($uid);
		$email = strtolower(trim((string)$this->request->getParam('email', '')));
		$kasLogin = trim((string)$this->request->getParam('kasLogin', ''));
		$kasPassword = (string)$this->request->getParam('kasPassword', '');
		if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse(['message' => 'Invalid email address'], Http::STATUS_BAD_REQUEST);
		}
		[$localPart, $domainPart] = explode('@', $email, 2);
		if ($localPart === '' || $domainPart === '') {
			return new DataResponse(['message' => 'Invalid email address'], Http::STATUS_BAD_REQUEST);
		}
		if (($kasLogin === '') !== ($kasPassword === '')) {
			return new DataResponse([
				'message' => 'Provide both temporary KAS login and password, or neither',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			// 24 characters, URL-safe, with upper/lowercase letters and digits.
			$mailboxPassword = rtrim(strtr(base64_encode(random_bytes(18)), '+/', 'Aa'), '=');
			$this->kasMailClient->createMailbox(
				$localPart,
				$domainPart,
				$mailboxPassword,
				$kasLogin === '' ? null : $kasLogin,
				$kasPassword === '' ? null : $kasPassword,
			);
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => $exception->getMessage(),
			], Http::STATUS_BAD_GATEWAY);
		}

		return new DataResponse([
			'message' => sprintf('ALL-INKL mailbox "%s" created', $email),
			'email' => $email,
			// Returned exactly once so an administrator can provide IMAP credentials.
			'mailboxPassword' => $mailboxPassword,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function testKasConnection(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse(['message' => 'Admin permissions required'], Http::STATUS_FORBIDDEN);
		}

		$kasLogin = trim((string)$this->request->getParam('kasLogin', ''));
		$kasPassword = (string)$this->request->getParam('kasPassword', '');
		if (($kasLogin === '') !== ($kasPassword === '')) {
			return new DataResponse([
				'message' => 'Provide both temporary KAS login and password, or neither',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			$statistics = $this->kasMailClient->getBasicStatistics(
				$kasLogin === '' ? null : $kasLogin,
				$kasPassword === '' ? null : $kasPassword,
			);
		} catch (\Throwable $exception) {
			return new DataResponse(['message' => $exception->getMessage()], Http::STATUS_BAD_GATEWAY);
		}

		return new DataResponse([
			'message' => 'Connected to the ALL-INKL KAS API',
			'statistics' => $statistics,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function listKasMailAccounts(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse(['message' => 'Admin permissions required'], Http::STATUS_FORBIDDEN);
		}

		$kasLogin = trim((string)$this->request->getParam('kasLogin', ''));
		$kasPassword = (string)$this->request->getParam('kasPassword', '');
		if (($kasLogin === '') !== ($kasPassword === '')) {
			return new DataResponse([
				'message' => 'Provide both temporary KAS login and password, or neither',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			$accounts = $this->kasMailClient->getMailAccounts(
				$kasLogin === '' ? null : $kasLogin,
				$kasPassword === '' ? null : $kasPassword,
			);
		} catch (\Throwable $exception) {
			return new DataResponse(['message' => $exception->getMessage()], Http::STATUS_BAD_GATEWAY);
		}

		return new DataResponse([
			'message' => 'Existing KAS email accounts loaded',
			'accounts' => $accounts,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function createTemporaryKasMailbox(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse(['message' => 'Admin permissions required'], Http::STATUS_FORBIDDEN);
		}

		$kasLogin = trim((string)$this->request->getParam('kasLogin', ''));
		$kasPassword = (string)$this->request->getParam('kasPassword', '');
		if (($kasLogin === '') !== ($kasPassword === '')) {
			return new DataResponse([
				'message' => 'Provide both temporary KAS login and password, or neither',
			], Http::STATUS_BAD_REQUEST);
		}

		try {
			$mailboxPassword = rtrim(strtr(base64_encode(random_bytes(18)), '+/', 'Aa'), '=');
			$this->kasMailClient->createMailbox(
				'foo.bar',
				'hufak.net',
				$mailboxPassword,
				$kasLogin === '' ? null : $kasLogin,
				$kasPassword === '' ? null : $kasPassword,
			);
		} catch (\Throwable $exception) {
			return new DataResponse(['message' => $exception->getMessage()], Http::STATUS_BAD_GATEWAY);
		}

		return new DataResponse([
			'message' => 'Temporary mailbox "foo.bar@hufak.net" created',
			'email' => 'foo.bar@hufak.net',
			'mailboxPassword' => $mailboxPassword,
		]);
	}
	/** @NoAdminRequired */
	public function listKasMailboxAddresses(): DataResponse {
		if (!$this->currentUserIsAdmin()) return new DataResponse(['message'=>'Admin permissions required'], Http::STATUS_FORBIDDEN);
		try { return new DataResponse($this->kasMailClient->mailboxOptions()); }
		catch (\Throwable $e) { return new DataResponse(['message'=>$e->getMessage()], Http::STATUS_BAD_GATEWAY); }
	}
	/** @NoAdminRequired */
	public function getKasMailServerSettings(): DataResponse {
		if (!$this->currentUserIsAdmin()) return new DataResponse(['message'=>'Admin permissions required'], Http::STATUS_FORBIDDEN);
		try { return new DataResponse(['host'=>$this->kasMailClient->mailServerHost()]); }
		catch (\Throwable $e) { return new DataResponse(['message'=>$e->getMessage()], Http::STATUS_BAD_GATEWAY); }
	}

	/**
	 * @NoAdminRequired
	 */
	public function sendUserWelcomeEmail(string $uid): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse(['message' => 'Admin permissions required'], Http::STATUS_FORBIDDEN);
		}
		$uid = trim($uid);
		$user = $uid === '' ? null : $this->userManager->get($uid);
		if ($user === null) {
			return new DataResponse(['message' => 'Unknown user'], Http::STATUS_BAD_REQUEST);
		}
		try {
			$mailHelper = \OCP\Server::get(\OCA\Settings\Mailer\NewUserMailHelper::class);
			$mailHelper->sendMail($user, $mailHelper->generateTemplate($user, true));
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Welcome email could not be sent: ' . $exception->getMessage(),
			], Http::STATUS_BAD_GATEWAY);
		}

		return new DataResponse(['message' => sprintf('Welcome email sent to user "%s"', $uid)]);
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
		$useKasPassword = trim((string)$this->request->getParam('useKasPassword', '')) === '1';
		if ($password === '' && $useKasPassword && $email !== '') {
			try {
				$password = (string)($this->kasMailClient->mailboxCredentials($email)['mail_password'] ?? '');
			} catch (\Throwable $exception) {
				return new DataResponse(['message' => $exception->getMessage()], Http::STATUS_BAD_GATEWAY);
			}
		}
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
				self::SNAPPYMAIL_OCC_COMMAND,
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
					self::SNAPPYMAIL_OCC_COMMAND,
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
			$hint = 'Exit code 64 indicates invalid command usage. Check ' . self::SNAPPYMAIL_OCC_COMMAND . ' argument format in your installed NextSnapMail version.';
		}

		$identitiesFileMessage = '';
		if ($process->isSuccessful()) {
			$identitiesResult = $this->ensureIdentityFileExists(
				$this->resolveSnappymailStoragePath($email, 'identities'),
				$email,
			);
			$identitiesFileMessage = $identitiesResult['message'];
		}

		return new DataResponse([
			'exitCode' => $process->getExitCode(),
			'message' => $process->isSuccessful()
				? self::SNAPPYMAIL_OCC_COMMAND . ' command finished successfully'
				: self::SNAPPYMAIL_OCC_COMMAND . ' command failed',
			'output' => $process->getOutput(),
			'errorOutput' => $errorOutput,
			'hint' => $hint,
			'identitiesFileMessage' => $identitiesFileMessage,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function deletePrimarySnappymailAccount(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim((string)$this->request->getParam('uid', ''));
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}

		$this->config->deleteUserValue(
			$uid,
			self::SNAPPYMAIL_USER_CONFIG_APP,
			self::SNAPPYMAIL_USER_CONFIG_EMAIL,
		);

		return new DataResponse([
			'message' => 'Primary e-mail account removed',
			'uid' => $uid,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function deleteAdditionalSnappymailAccount(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim((string)$this->request->getParam('uid', ''));
		$email = trim((string)$this->request->getParam('email', ''));
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}
		if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse([
				'message' => 'Invalid additional account email',
			], Http::STATUS_BAD_REQUEST);
		}

		$primaryEmail = $this->config->getUserValue(
			$uid,
			self::SNAPPYMAIL_USER_CONFIG_APP,
			self::SNAPPYMAIL_USER_CONFIG_EMAIL,
			'',
		);
		$path = $this->resolveSnappymailStoragePath($primaryEmail, 'additionalaccounts');
		if ($path === null) {
			return new DataResponse([
				'message' => 'Additional accounts file not found for user',
			], Http::STATUS_NOT_FOUND);
		}

		try {
			$file = $this->rootFolder->get($path);
			if (!$file instanceof File) {
				return new DataResponse([
					'message' => 'Additional accounts path is not a file',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			$content = (string)$file->getContent();
			$decoded = json_decode($content, true);
			if (!is_array($decoded)) {
				return new DataResponse([
					'message' => 'Additional accounts file does not contain valid JSON',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			$didRemove = false;
			foreach ($decoded as $accountKey => $accountConfig) {
				if (!is_array($accountConfig)) {
					continue;
				}
				$entryEmail = isset($accountConfig['email']) && is_scalar($accountConfig['email'])
					? trim((string)$accountConfig['email'])
					: '';
				if ($entryEmail === $email) {
					unset($decoded[$accountKey]);
					$didRemove = true;
				}
			}

			if (!$didRemove) {
				return new DataResponse([
					'message' => 'Additional account not found in storage file',
				], Http::STATUS_NOT_FOUND);
			}

			$encoded = json_encode(
				$decoded,
				JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
			);
			if ($encoded === false) {
				return new DataResponse([
					'message' => 'Failed to encode updated additional accounts JSON',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			$file->putContent($encoded . "\n");
		} catch (\Throwable $exception) {
			$errorMessage = trim($exception->getMessage());
			return new DataResponse([
				'message' => $errorMessage === ''
					? 'Failed to update additional accounts file'
					: sprintf('Failed to update additional accounts file: %s', $errorMessage),
				'error' => $errorMessage,
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'message' => 'Additional account deleted',
			'uid' => $uid,
			'email' => $email,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function addAdditionalSnappymailAccount(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim((string)$this->request->getParam('uid', ''));
		$email = trim((string)$this->request->getParam('email', ''));
		$password = (string)$this->request->getParam('password', '');
		$useKasPassword = trim((string)$this->request->getParam('useKasPassword', '')) === '1';
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}
		if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
			return new DataResponse([
				'message' => 'Invalid additional account email',
			], Http::STATUS_BAD_REQUEST);
		}
		if ($password === '' && $useKasPassword) {
			try { $password = (string)($this->kasMailClient->mailboxCredentials($email)['mail_password'] ?? ''); }
			catch (\Throwable $e) { return new DataResponse(['message' => $e->getMessage()], Http::STATUS_BAD_GATEWAY); }
		}
		if ($password === '') {
			return new DataResponse([
				'message' => 'Additional account password is required',
			], Http::STATUS_BAD_REQUEST);
		}

		$primaryEmail = $this->config->getUserValue(
			$uid,
			self::SNAPPYMAIL_USER_CONFIG_APP,
			self::SNAPPYMAIL_USER_CONFIG_EMAIL,
			'',
		);
		$path = $this->resolveSnappymailStoragePath($primaryEmail, 'additionalaccounts');
		if ($path === null) {
			return new DataResponse([
				'message' => 'Primary account must be configured before adding additional accounts',
			], Http::STATUS_BAD_REQUEST);
		}
		$parentPath = dirname($path);

		try {
			$decoded = [];
			if ($this->rootFolder->nodeExists($path)) {
				try {
					$file = $this->rootFolder->get($path);
					if (!$file instanceof File) {
						return new DataResponse([
							'message' => 'Additional accounts path is not a file',
						], Http::STATUS_INTERNAL_SERVER_ERROR);
					}

					$content = (string)$file->getContent();
					if (trim($content) !== '') {
						$current = json_decode($content, true);
						if (!is_array($current)) {
							return new DataResponse([
								'message' => 'Additional accounts file does not contain valid JSON',
							], Http::STATUS_INTERNAL_SERVER_ERROR);
						}
						$decoded = $current;
					}
				} catch (\Throwable $exception) {
					if (!$this->isMissingOptionalStorageException($exception)) {
						throw $exception;
					}
				}
			} else {
				if (!$this->rootFolder->nodeExists($parentPath)) {
					return new DataResponse([
						'message' => 'Additional accounts storage path not found for user',
					], Http::STATUS_NOT_FOUND);
				}
			}

			foreach ($decoded as $accountConfig) {
				if (!is_array($accountConfig)) {
					continue;
				}
				$entryEmail = isset($accountConfig['email']) && is_scalar($accountConfig['email'])
					? trim((string)$accountConfig['email'])
					: '';
				if ($entryEmail === $email) {
					return new DataResponse([
						'message' => 'Additional account already exists',
					], Http::STATUS_CONFLICT);
				}
			}

			$decoded[$email] = [
				'email' => $email,
				'login' => $email,
				'pass' => $password,
				'name' => '',
				'smtp' => [
					'user' => $email,
				],
			];

			$encoded = json_encode(
				$decoded,
				JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
			);
			if ($encoded === false) {
				return new DataResponse([
					'message' => 'Failed to encode updated additional accounts JSON',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			if ($this->rootFolder->nodeExists($path)) {
				$file = $this->rootFolder->get($path);
				if (!$file instanceof File) {
					return new DataResponse([
						'message' => 'Additional accounts path is not a file',
					], Http::STATUS_INTERNAL_SERVER_ERROR);
				}
				$file->putContent($encoded . "\n");
			} else {
				$parentFolder = $this->rootFolder->get($parentPath);
				if (!$parentFolder instanceof \OCP\Files\Folder) {
					return new DataResponse([
						'message' => 'Additional accounts storage folder not found',
					], Http::STATUS_INTERNAL_SERVER_ERROR);
				}
				if (!method_exists($parentFolder, 'newFile')) {
					return new DataResponse([
						'message' => sprintf(
							'Additional accounts storage folder is not writable via newFile (%s)',
							$parentPath,
						),
					], Http::STATUS_INTERNAL_SERVER_ERROR);
				}

				$fileName = basename($path);
				if ($fileName === '' || $fileName === '.' || $fileName === '..') {
					return new DataResponse([
						'message' => sprintf(
							'Resolved additional accounts file name is invalid (path=%s)',
							$path,
						),
					], Http::STATUS_INTERNAL_SERVER_ERROR);
				}

				$createdNode = $parentFolder->newFile($fileName);
				if (!$createdNode instanceof File) {
					$createdNode = $this->rootFolder->get($path);
					if (!$createdNode instanceof File) {
						return new DataResponse([
							'message' => sprintf(
								'Additional accounts file was created but could not be reopened as a file (path=%s)',
								$path,
							),
						], Http::STATUS_INTERNAL_SERVER_ERROR);
					}
				}
				$createdNode->putContent($encoded . "\n");
			}
		} catch (\Throwable $exception) {
			$errorMessage = trim($exception->getMessage());
			$exceptionClass = $exception::class;
			$details = [
				sprintf('uid=%s', $uid),
				sprintf('primaryEmail=%s', $primaryEmail !== '' ? $primaryEmail : '(empty)'),
				sprintf('storagePath=%s', $path),
				sprintf('parentPath=%s', $parentPath),
				sprintf('pathExists=%s', $this->rootFolder->nodeExists($path) ? 'yes' : 'no'),
				sprintf('parentExists=%s', $this->rootFolder->nodeExists($parentPath) ? 'yes' : 'no'),
				sprintf('exception=%s', $exceptionClass),
			];
			if ($errorMessage !== '') {
				$details[] = sprintf('detail=%s', $errorMessage);
			}
			return new DataResponse([
				'message' => sprintf(
					'Failed to update additional accounts file (%s)',
					implode('; ', $details),
				),
				'error' => $errorMessage,
				'exceptionClass' => $exceptionClass,
				'uid' => $uid,
				'primaryEmail' => $primaryEmail,
				'storagePath' => $path,
				'parentPath' => $parentPath,
				'pathExists' => $this->rootFolder->nodeExists($path),
				'parentExists' => $this->rootFolder->nodeExists($parentPath),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'message' => sprintf(
				'Additional account added. %s',
				$this->ensureIdentityFileExists(
					$this->resolveAdditionalAccountIdentitiesPath($primaryEmail, $email),
					$email,
				)['message'],
			),
			'uid' => $uid,
			'email' => $email,
		]);
	}

	/**
	 * @NoAdminRequired
	 */
	public function setSnappymailIdentitySignature(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$uid = trim((string)$this->request->getParam('uid', ''));
		$index = $this->request->getParam('index', null);
		$signature = (string)$this->request->getParam('signature', '');
		$displayName = trim((string)$this->request->getParam('displayName', ''));
		$accountType = trim((string)$this->request->getParam('accountType', ''));
		$accountKey = trim((string)$this->request->getParam('accountKey', ''));
		if ($uid === '' || !$this->userManager->userExists($uid)) {
			return new DataResponse([
				'message' => 'Unknown user',
			], Http::STATUS_BAD_REQUEST);
		}
		if (!is_numeric($index) || (int)$index < 0) {
			return new DataResponse([
				'message' => 'Invalid identity index',
			], Http::STATUS_BAD_REQUEST);
		}
		if ($accountType !== 'primary' && $accountKey === '') {
			return new DataResponse([
				'message' => 'accountKey is required for non-primary identities',
			], Http::STATUS_BAD_REQUEST);
		}

		$primaryEmail = $this->config->getUserValue(
			$uid,
			self::SNAPPYMAIL_USER_CONFIG_APP,
			self::SNAPPYMAIL_USER_CONFIG_EMAIL,
			'',
		);
		$path = $accountType === 'primary'
			? $this->resolveSnappymailStoragePath($primaryEmail, 'identities')
			: $this->resolveAdditionalAccountIdentitiesPath($primaryEmail, $accountKey);
		if ($path === null || !$this->rootFolder->nodeExists($path)) {
			return new DataResponse([
				'message' => 'Identities file not found',
			], Http::STATUS_NOT_FOUND);
		}

		try {
			$file = $this->rootFolder->get($path);
			if (!$file instanceof File) {
				return new DataResponse([
					'message' => 'Identities path is not a file',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}
			$content = (string)$file->getContent();
			$decoded = json_decode($content, true);
			if (!is_array($decoded)) {
				return new DataResponse([
					'message' => 'Identities file does not contain valid JSON',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			$identityIndex = (int)$index;
			if (array_is_list($decoded)) {
				if (!array_key_exists($identityIndex, $decoded) || !is_array($decoded[$identityIndex])) {
					return new DataResponse([
						'message' => 'Identity not found',
					], Http::STATUS_NOT_FOUND);
				}
				if (array_key_exists('signature', $decoded[$identityIndex])) {
					$decoded[$identityIndex]['signature'] = $signature;
				} elseif (array_key_exists('Signature', $decoded[$identityIndex])) {
					$decoded[$identityIndex]['Signature'] = $signature;
				} else {
					$decoded[$identityIndex]['signature'] = $signature;
				}
				if (array_key_exists('Name', $decoded[$identityIndex])) {
					$decoded[$identityIndex]['Name'] = $displayName;
				} elseif (array_key_exists('name', $decoded[$identityIndex])) {
					$decoded[$identityIndex]['name'] = $displayName;
				} else {
					$decoded[$identityIndex]['Name'] = $displayName;
				}
				$decoded[$identityIndex]['SignatureInsertBefore'] = true;
			} else {
				$keys = array_keys($decoded);
				if (!array_key_exists($identityIndex, $keys) || !is_array($decoded[$keys[$identityIndex]])) {
					return new DataResponse([
						'message' => 'Identity not found',
					], Http::STATUS_NOT_FOUND);
				}
				$identityKey = $keys[$identityIndex];
				if (array_key_exists('signature', $decoded[$identityKey])) {
					$decoded[$identityKey]['signature'] = $signature;
				} elseif (array_key_exists('Signature', $decoded[$identityKey])) {
					$decoded[$identityKey]['Signature'] = $signature;
				} else {
					$decoded[$identityKey]['signature'] = $signature;
				}
				if (array_key_exists('Name', $decoded[$identityKey])) {
					$decoded[$identityKey]['Name'] = $displayName;
				} elseif (array_key_exists('name', $decoded[$identityKey])) {
					$decoded[$identityKey]['name'] = $displayName;
				} else {
					$decoded[$identityKey]['Name'] = $displayName;
				}
				$decoded[$identityKey]['SignatureInsertBefore'] = true;
			}

			$encoded = json_encode(
				$decoded,
				JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
			);
			if ($encoded === false) {
				return new DataResponse([
					'message' => 'Failed to encode updated identities JSON',
				], Http::STATUS_INTERNAL_SERVER_ERROR);
			}

			$file->putContent($encoded . "\n");
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to update identities file',
				'error' => $exception->getMessage(),
			], Http::STATUS_INTERNAL_SERVER_ERROR);
		}

		return new DataResponse([
			'message' => 'Identity signature updated',
			'uid' => $uid,
			'index' => (int)$index,
			'accountType' => $accountType === 'primary' ? 'primary' : 'additional',
			'accountKey' => $accountKey,
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
	public function getNewAccountTemplate(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		try {
			$template = $this->readNewAccountTemplate();
		} catch (\Throwable $exception) {
			return new DataResponse([
				'message' => 'Failed to load account info template',
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
	public function setNewAccountTemplate(): DataResponse {
		if (!$this->currentUserIsAdmin()) {
			return new DataResponse([
				'message' => 'Admin permissions required',
			], Http::STATUS_FORBIDDEN);
		}

		$template = (string)$this->request->getParam('template', '');
		$this->config->setAppValue($this->appName, self::CONFIG_NEW_ACCOUNT_TEMPLATE, $template);

		return new DataResponse([
			'message' => 'Account info template saved',
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
		$configuredDashboardLayout = $this->getConfiguredDashboardLayout();
		$selectedUid = trim((string)$this->request->getParam('uid', ''));
		$includePronoun = trim((string)$this->request->getParam('includePronoun', '')) === '1';
		$users = [];
		$disabledUsers = [];
		$this->userManager->callForAllUsers(function ($user) use (&$users, &$disabledUsers, $configuredApporder, $configuredDashboardLayout, $selectedUid, $includePronoun): void {
			$uid = $user->getUID();
			if ($selectedUid !== '' && $uid !== $selectedUid) {
				return;
			}
			if (!$user->isEnabled()) {
				$disabledUsers[] = [
					'uid' => $uid,
				];
				return;
			}

			$primaryEmail = $this->config->getUserValue(
				$uid,
				self::SNAPPYMAIL_USER_CONFIG_APP,
				self::SNAPPYMAIL_USER_CONFIG_EMAIL,
				'',
			);
			$additionalAccountsLookupError = null;
			$identitiesLookupError = null;
			$additionalAccounts = $this->loadSnappymailStorageJson(
				$primaryEmail,
				'additionalaccounts',
				$additionalAccountsLookupError,
			);
			$identities = $this->normalizeIdentityRecords(
				$this->loadSnappymailStorageJson(
					$primaryEmail,
					'identities',
					$identitiesLookupError,
				),
			);
			$additionalAccountIdentitiesLookupErrors = [];
			$additionalAccountIdentities = $this->loadAdditionalAccountIdentities(
				$primaryEmail,
				$additionalAccounts,
				$additionalAccountIdentitiesLookupErrors,
			);
			$userApporder = $this->config->getUserValue(
				$uid,
				'core',
				'apporder',
				'',
			);
			$userDashboardLayout = $this->normalizeDashboardLayout(
				$this->config->getUserValue($uid, 'dashboard', 'layout', ''),
			);

			$users[] = [
				'uid' => $uid,
				'accountName' => (string)$user->getDisplayName(),
				'pronoun' => $includePronoun ? $this->resolveUserPronoun($uid) : '',
				'lastActivityTs' => $user->getLastLogin(),
				'failedLoginAttempts' => $this->resolveFailedLoginAttempts($user),
				'primaryEmail' => $primaryEmail,
				'additionalAccounts' => $additionalAccounts,
				'identities' => $identities,
				'additionalAccountsLookupError' => $additionalAccountsLookupError,
				'identitiesLookupError' => $identitiesLookupError,
				'additionalAccountIdentities' => $additionalAccountIdentities,
				'additionalAccountIdentitiesLookupErrors' => $additionalAccountIdentitiesLookupErrors,
				'apporderMatches' => $this->apporderMatchesConfigured($userApporder, $configuredApporder),
				'apporderDiff' => $this->buildJsondiffpatchLikeApporderDiff($userApporder, $configuredApporder),
				'apporder' => $userApporder,
				'dashboardLayout' => $userDashboardLayout,
				// without a configured default there is no drift to report
				'dashboardLayoutMatches' => $configuredDashboardLayout === ''
					|| ($userDashboardLayout !== ''
						&& $userDashboardLayout === $configuredDashboardLayout),
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
			'defaultApporder' => $configuredApporder,
			'defaultDashboardLayout' => $configuredDashboardLayout,
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

	private function normalizeDashboardLayout(string $layout): string {
		$widgetIds = array_filter(
			array_map('trim', explode(',', $layout)),
			static fn (string $widgetId): bool => $widgetId !== '',
		);
		return implode(',', $widgetIds);
	}

	private function getConfiguredDashboardLayout(): string {
		$current = $this->normalizeDashboardLayout(
			$this->config->getAppValue($this->appName, self::CONFIG_DASHBOARD_LAYOUT, ''),
		);
		if ($current !== '') {
			return $current;
		}

		// fall back to whatever the dashboard app itself hands new accounts
		return $this->normalizeDashboardLayout(
			$this->config->getAppValue('dashboard', 'layout', ''),
		);
	}

	private function getConfiguredFreescoutPath(): string {
		$configured = trim($this->config->getAppValue(
			$this->appName,
			self::CONFIG_FREESCOUT_PATH,
			self::DEFAULT_FREESCOUT_PATH,
		));
		return $configured === '' ? self::DEFAULT_FREESCOUT_PATH : $configured;
	}

	private function resolveFreescoutRoot(): ?string {
		$path = $this->getConfiguredFreescoutPath();
		if (!str_starts_with($path, '/')) {
			$path = \OC::$SERVERROOT . '/' . $path;
		}

		$resolved = realpath($path);
		if ($resolved === false || !is_file($resolved . '/artisan')) {
			return null;
		}

		return $resolved;
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

	private function buildJsondiffpatchLikeApporderDiff(string $userApporder, string $configuredApporder): array {
		$left = $this->decodeJsonOrString($userApporder);
		$right = $this->decodeJsonOrString($configuredApporder);
		$diff = $this->jsondiffpatchLikeDiff($left, $right);
		return is_array($diff) ? $diff : [];
	}

	private function decodeJsonOrString(string $raw): mixed {
		$trimmed = trim($raw);
		if ($trimmed === '') {
			return [];
		}

		$decoded = json_decode($trimmed, true);
		return json_last_error() === JSON_ERROR_NONE ? $decoded : $trimmed;
	}

	private function jsondiffpatchLikeDiff(mixed $left, mixed $right): mixed {
		if (is_array($left) && is_array($right)) {
			$isLeftAssoc = array_keys($left) !== range(0, count($left) - 1);
			$isRightAssoc = array_keys($right) !== range(0, count($right) - 1);
			if (!$isLeftAssoc || !$isRightAssoc) {
				return $left === $right ? null : [$left, $right];
			}

			$diff = [];
			$keys = array_unique(array_merge(array_keys($left), array_keys($right)));
			foreach ($keys as $key) {
				$inLeft = array_key_exists($key, $left);
				$inRight = array_key_exists($key, $right);
				if ($inLeft && !$inRight) {
					$diff[$key] = [$left[$key], 0, 0];
					continue;
				}
				if (!$inLeft && $inRight) {
					$diff[$key] = [$right[$key]];
					continue;
				}

				$childDiff = $this->jsondiffpatchLikeDiff($left[$key], $right[$key]);
				if ($childDiff !== null && (!(is_array($childDiff)) || count($childDiff) > 0)) {
					$diff[$key] = $childDiff;
				}
			}

			return count($diff) > 0 ? $diff : null;
		}

		return $left === $right ? null : [$left, $right];
	}

	private function loadSnappymailStorageJson(
		string $primaryEmail,
		string $fileName,
		?string &$error = null,
	): ?array {
		$candidatePath = $this->resolveSnappymailStoragePath($primaryEmail, $fileName);
		if ($candidatePath === null) {
			return null;
		}

		try {
			if (!$this->rootFolder->nodeExists($candidatePath)) {
				$error = sprintf('Path does not exist: %s', $candidatePath);
				return null;
			}
			$file = $this->rootFolder->get($candidatePath);
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
			if ($this->isMissingOptionalStorageException($exception)) {
				$error = sprintf('Path does not exist: %s', $candidatePath);
				return null;
			}
			$error = sprintf('Failed to load %s: %s', $candidatePath, $exception->getMessage());
			return null;
		}
	}

	private function isMissingOptionalStorageException(\Throwable $exception): bool {
		$message = strtolower(trim($exception->getMessage()));
		$exceptionClass = $exception::class;
		if ($message === '') {
			return $exceptionClass === \OCP\Files\GenericFileException::class;
		}

		return str_contains($message, 'no such file or directory')
			|| str_contains($message, 'failed to open stream');
	}

	private function ensureIdentityFileExists(?string $path, string $email): array {
		if ($path === null) {
			return [
				'created' => false,
				'message' => 'Could not determine identities file path.',
			];
		}

		try {
			if ($this->rootFolder->nodeExists($path)) {
				return [
					'created' => false,
					'message' => 'Identity file already existed.',
				];
			}

			$parentPath = dirname($path);
			if (!$this->rootFolder->nodeExists($parentPath)) {
				$baseFolderPath = dirname($parentPath);
				$folderName = basename($parentPath);
				if (
					$folderName === ''
					|| $folderName === '.'
					|| $folderName === '..'
					|| !$this->rootFolder->nodeExists($baseFolderPath)
				) {
					return [
						'created' => false,
						'message' => 'Identity file was not created because the account folder does not exist.',
					];
				}

				$baseFolder = $this->rootFolder->get($baseFolderPath);
				if (!method_exists($baseFolder, 'newFolder')) {
					return [
						'created' => false,
						'message' => 'Identity file was not created because the parent storage folder is invalid.',
					];
				}

				$createdFolder = $baseFolder->newFolder($folderName);
				if (!method_exists($createdFolder, 'newFile')) {
					return [
						'created' => false,
						'message' => 'Identity file was not created because the account folder could not be created.',
					];
				}
			}

			$payload = json_encode([
				'---' => [
					'Email' => $email,
					'Signature' => 'foo',
					'SignatureInsertBefore' => true,
				],
			], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
			if ($payload === false) {
				return [
					'created' => false,
					'message' => 'Identity file was not created because the default content could not be encoded.',
				];
			}

			$folder = $this->rootFolder->get($parentPath);
			if (!method_exists($folder, 'newFile')) {
				return [
					'created' => false,
					'message' => 'Identity file was not created because the account folder is invalid.',
				];
			}

			$folder->newFile(basename($path), $payload);

			return [
				'created' => true,
				'message' => 'Created new identity file.',
			];
		} catch (\Throwable $exception) {
			return [
				'created' => false,
				'message' => 'Identity file was not created: ' . $exception->getMessage(),
			];
		}
	}

	private function resolveSnappymailStoragePath(string $primaryEmail, string $fileName): ?string {
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

		return self::SNAPPYMAIL_STORAGE_ROOT
			. $domain
			. '/'
			. $prefix
			. '/'
			. $fileName;
	}

	private function resolveAdditionalAccountIdentitiesPath(string $primaryEmail, string $additionalAccount): ?string {
		$email = trim($primaryEmail);
		$additionalAccount = trim($additionalAccount);
		if ($email === '' || $additionalAccount === '' || !str_contains($email, '@')) {
			return null;
		}

		[$prefix, $domain] = explode('@', $email, 2);
		$prefix = trim($prefix);
		$domain = strtolower(trim($domain));
		if ($prefix === '' || $domain === '') {
			return null;
		}

		return self::SNAPPYMAIL_STORAGE_ROOT
			. $domain . '/'
			. $prefix . '/'
			. $additionalAccount . '/'
			. 'identities';
	}

	private function normalizeIdentityRecords(?array $identities): ?array {
		if ($identities === null || !is_array($identities)) {
			return $identities;
		}

		$entries = [];
		$isList = array_is_list($identities);
		foreach ($identities as $key => $identity) {
			$normalizedIdentity = $this->normalizeIdentityRecord($identity);
			if (!is_array($normalizedIdentity)) {
				continue;
			}
			if ($isList) {
				$entries[] = $normalizedIdentity;
			} else {
				$entries[$key] = $normalizedIdentity;
			}
		}

		return $entries;
	}

	private function resolveUserPronoun(string $uid): string {
		$phpBinary = $this->resolveCompatiblePhpBinary();
		if ($phpBinary === null) {
			return '';
		}

		try {
			$process = new Process([
				$phpBinary,
				\OC::$SERVERROOT . '/occ',
				'user:profile',
				$uid,
			], \OC::$SERVERROOT);
			$process->setTimeout(60);
			$process->run();

			$errorOutput = $process->getErrorOutput();
			if ($process->getExitCode() !== 0 && str_contains($errorOutput, 'opcache.file_cache_only')) {
				$opcacheDir = sys_get_temp_dir() . '/hufak-opcache';
				if (!is_dir($opcacheDir) && !mkdir($opcacheDir, 0770, true) && !is_dir($opcacheDir)) {
					return '';
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
					'user:profile',
					$uid,
				], \OC::$SERVERROOT);
				$process->setTimeout(60);
				$process->run();
			}

			if (!$process->isSuccessful()) {
				return '';
			}

			$output = $process->getOutput();
			if (preg_match('/^\s*-\s*pronouns:\s*(.+)\s*$/mi', $output, $matches) === 1) {
				return trim($matches[1]);
			}
		} catch (\Throwable) {
			return '';
		}

		return '';
	}

	private function normalizeIdentityRecord(mixed $identity): ?array {
		if (!is_array($identity)) {
			return null;
		}

		$signature = '';
		if (array_key_exists('signature', $identity)) {
			$signatureValue = $identity['signature'];
			if (is_scalar($signatureValue)) {
				$signature = (string)$signatureValue;
			}
		} elseif (array_key_exists('Signature', $identity)) {
			$signatureValue = $identity['Signature'];
			if (is_scalar($signatureValue)) {
				$signature = (string)$signatureValue;
			}
		}

		$identity['signature'] = $signature;
		return $identity;
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

			$path = self::SNAPPYMAIL_STORAGE_ROOT
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
					$results[$additionalAccount] = $this->normalizeIdentityRecords($decoded);
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

	private function readNewAccountTemplate(): string {
		$template = $this->config->getAppValue($this->appName, self::CONFIG_NEW_ACCOUNT_TEMPLATE, '');
		if ($template !== '') {
			return $template;
		}

		$defaultTemplatePath = dirname(__DIR__, 2) . '/' . self::DEFAULT_NEW_ACCOUNT_TEMPLATE_FILE;
		if (!is_readable($defaultTemplatePath)) {
			throw new \RuntimeException('Default new-account template is not readable: ' . $defaultTemplatePath);
		}
		$defaultTemplate = file_get_contents($defaultTemplatePath);
		if ($defaultTemplate === false) {
			throw new \RuntimeException('Failed to read default new-account template');
		}

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
