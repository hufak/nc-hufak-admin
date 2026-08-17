<?php

declare(strict_types=1);

namespace OCA\Hufak\Service;

use OCP\Http\Client\IClientService;

/** Server-only client for the Telegram Bot API. */
class TelegramBotClient {
	private const API_ENDPOINT = 'https://api.telegram.org';
	private const PROMOTABLE_RIGHTS = [
		'can_manage_chat', 'can_delete_messages', 'can_manage_video_chats', 'can_restrict_members',
		'can_promote_members', 'can_change_info', 'can_invite_users', 'can_post_stories',
		'can_edit_stories', 'can_delete_stories', 'can_post_messages', 'can_edit_messages',
		'can_pin_messages', 'can_manage_topics', 'can_manage_direct_messages', 'can_manage_tags',
	];

	public function __construct(private IClientService $clientService) {
	}

	/** @return array<string, mixed> */
	public function testToken(string $token): array {
		return $this->request($token, 'getMe');
	}

	/** @return list<array{user: array<string, mixed>, status: string, adminLabel: string, isAnonymous: bool, isEditable: bool, rights: array<string, bool>, isAdministrator: bool}> */
	public function getChatAdministrators(string $token, string $chatId): array {
		$administrators = [];
		foreach ($this->rawChatAdministrators($token, $chatId) as $member) {
			if (!is_array($member) || !is_array($member['user'] ?? null)) {
				continue;
			}
			$rights = [];
			foreach (self::PROMOTABLE_RIGHTS as $right) {
				$rights[$right] = (bool)($member[$right] ?? false);
			}
			$administrators[] = [
				'user' => $member['user'],
				'status' => (string)($member['status'] ?? ''),
				'adminLabel' => (string)($member['custom_title'] ?? ''),
				'isAnonymous' => (bool)($member['is_anonymous'] ?? false),
				'isEditable' => (bool)($member['can_be_edited'] ?? false),
				'rights' => $rights,
				'isAdministrator' => true,
			];
		}
		return $administrators;
	}

	/**
	 * Returns known users from a roster who are currently members of a chat.
	 *
	 * Telegram's Bot API does not provide a way to enumerate all chat members,
	 * so callers must supply the user IDs that should be checked.
	 *
	 * @param list<string> $userIds
	 * @return list<array{user: array<string, mixed>, status: string, adminLabel: string, isAnonymous: bool, isEditable: bool, rights: array<string, bool>, isAdministrator: bool}>
	 */
	public function getChatMembersFromRoster(string $token, string $chatId, array $userIds): array {
		$members = [];
		foreach ($userIds as $userId) {
			try {
				$member = $this->request($token, 'getChatMember', ['chat_id' => $chatId, 'user_id' => $userId]);
			} catch (\Throwable) {
				// Telegram reports an error when a roster member is not in this chat.
				continue;
			}
			if (!is_array($member) || !is_array($member['user'] ?? null)
				|| in_array($member['status'] ?? '', ['left', 'kicked'], true)) {
				continue;
			}
			$members[] = [
				'user' => $member['user'],
				'status' => (string)($member['status'] ?? 'member'),
				'adminLabel' => (string)($member['tag'] ?? ''),
				'isAnonymous' => false,
				'isEditable' => false,
				'rights' => [],
				'isAdministrator' => false,
			];
		}
		return $members;
	}

	/**
	 * Collects known Hufak chat members from pending bot updates without exposing
	 * message content. Telegram retains unconsumed updates only temporarily, so
	 * this supplements rather than replaces the manually maintained roster.
	 *
	 * @return array{memberIds: list<string>, nextOffset: ?string}
	 */
	public function getHufakMemberIdsFromUpdates(string $token, string $chatId, ?string $offset): array {
		$parameters = [
			'timeout' => 0,
			'allowed_updates' => json_encode(['message', 'chat_member'], JSON_THROW_ON_ERROR),
		];
		if ($offset !== null && preg_match('/^\d+$/', $offset)) {
			$parameters['offset'] = $offset;
		}
		$updates = $this->request($token, 'getUpdates', $parameters);
		if (!is_array($updates) || !array_is_list($updates)) {
			throw new \RuntimeException('Telegram Bot API returned an invalid update list');
		}

		$memberIds = [];
		$highestUpdateId = null;
		foreach ($updates as $update) {
			if (!is_array($update)) {
				continue;
			}
			$updateId = $update['update_id'] ?? null;
			if (is_int($updateId) || (is_string($updateId) && preg_match('/^\d+$/', $updateId))) {
				$highestUpdateId = max($highestUpdateId ?? 0, (int)$updateId);
			}

			$message = $update['message'] ?? null;
			if (is_array($message) && (string)($message['chat']['id'] ?? '') === $chatId) {
				$userId = $message['from']['id'] ?? null;
				if (is_int($userId) || (is_string($userId) && preg_match('/^\d+$/', $userId))) {
					$memberIds[(string)$userId] = true;
				}
			}

			$membership = $update['chat_member'] ?? null;
			if (!is_array($membership) || (string)($membership['chat']['id'] ?? '') !== $chatId) {
				continue;
			}
			$newMembership = $membership['new_chat_member'] ?? null;
			$userId = is_array($newMembership) ? ($newMembership['user']['id'] ?? null) : null;
			$status = is_array($newMembership) ? ($newMembership['status'] ?? '') : '';
			if ((is_int($userId) || (is_string($userId) && preg_match('/^\d+$/', $userId)))
				&& !in_array($status, ['left', 'kicked'], true)) {
				$memberIds[(string)$userId] = true;
			}
		}

		return [
			'memberIds' => array_keys($memberIds),
			'nextOffset' => $highestUpdateId === null ? null : (string)($highestUpdateId + 1),
		];
	}

	/** @return list<string> */
	public function getAssignableAdministratorRights(string $token, string $chatId): array {
		$bot = $this->testToken($token);
		$botId = (string)($bot['id'] ?? '');
		if ($botId === '') {
			throw new \RuntimeException('Telegram Bot API did not return this bot\'s user ID');
		}
		$member = $this->request($token, 'getChatMember', ['chat_id' => $chatId, 'user_id' => $botId]);
		if (($member['status'] ?? '') !== 'administrator' || !($member['can_promote_members'] ?? false)) {
			return [];
		}
		return array_values(array_filter(
			self::PROMOTABLE_RIGHTS,
			static fn (string $right): bool => (bool)($member[$right] ?? false),
		));
	}

	public function setAdministratorAnonymity(string $token, string $chatId, string $userId, bool $isAnonymous): void {
		$member = $this->findEditableAdministrator($token, $chatId, $userId);
		$parameters = [
			'chat_id' => $chatId,
			'user_id' => $userId,
			'is_anonymous' => $isAnonymous,
		];
		foreach (self::PROMOTABLE_RIGHTS as $right) {
			$parameters[$right] = (bool)($member[$right] ?? false);
		}
		$this->request($token, 'promoteChatMember', $parameters, true);
	}

	public function setAdministratorLabel(string $token, string $chatId, string $userId, string $label): void {
		$this->findEditableAdministrator($token, $chatId, $userId);
		$this->request($token, 'setChatAdministratorCustomTitle', [
			'chat_id' => $chatId,
			'user_id' => $userId,
			'custom_title' => $label,
		], true);
	}

	/** Sets an administrator custom title or a regular-member tag as appropriate. */
	public function setChatMemberLabel(string $token, string $chatId, string $userId, string $label): void {
		$this->assertValidMemberLabel($label);
		$member = $this->request($token, 'getChatMember', ['chat_id' => $chatId, 'user_id' => $userId]);
		$status = (string)($member['status'] ?? '');
		if (in_array($status, ['administrator', 'creator'], true)) {
			$this->setAdministratorLabel($token, $chatId, $userId, $label);
			return;
		}
		if ($status !== 'member') {
			throw new \RuntimeException('Telegram user is not an active regular member of this group');
		}
		$this->request($token, 'setChatMemberTag', [
			'chat_id' => $chatId,
			'user_id' => $userId,
			'tag' => $label,
		], true);
	}

	/** @param array<string, bool> $rights */
	public function setAdministratorRights(string $token, string $chatId, string $userId, array $rights): void {
		$member = $this->findEditableAdministrator($token, $chatId, $userId);
		$assignableRights = array_flip($this->getAssignableAdministratorRights($token, $chatId));
		if ($assignableRights === []) {
			throw new \RuntimeException('Telegram does not allow this bot to change administrator rights');
		}
		$parameters = [
			'chat_id' => $chatId,
			'user_id' => $userId,
			'is_anonymous' => (bool)($member['is_anonymous'] ?? false),
		];
		foreach (self::PROMOTABLE_RIGHTS as $right) {
			$parameters[$right] = isset($assignableRights[$right])
				? (bool)($rights[$right] ?? false)
				: (bool)($member[$right] ?? false);
		}
		$this->request($token, 'promoteChatMember', $parameters, true);
	}

	public function dismissAdministrator(string $token, string $chatId, string $userId): void {
		$this->findEditableAdministrator($token, $chatId, $userId);
		$assignableRights = array_flip($this->getAssignableAdministratorRights($token, $chatId));
		if (!isset($assignableRights['can_promote_members'])) {
			throw new \RuntimeException('Telegram does not allow this bot to dismiss administrators');
		}
		$parameters = ['chat_id' => $chatId, 'user_id' => $userId, 'is_anonymous' => false];
		foreach (self::PROMOTABLE_RIGHTS as $right) {
			$parameters[$right] = false;
		}
		$this->request($token, 'promoteChatMember', $parameters, true);
	}

	/** @return array{user: array<string, mixed>, photo: ?string, isAdministrator: bool, administrator: ?array{adminLabel: string, isAnonymous: bool, isEditable: bool, rights: array<string, bool>}} */
	public function previewChatMember(string $token, string $chatId, string $identifier): array {
		if (str_starts_with($identifier, '@')) {
			throw new \RuntimeException('Telegram Bot API cannot resolve a user from @username; enter their numeric Telegram user ID');
		}
		if (!preg_match('/^\d+$/', $identifier)) {
			throw new \RuntimeException('Enter a numeric Telegram user ID');
		}
		$member = $this->request($token, 'getChatMember', ['chat_id' => $chatId, 'user_id' => $identifier]);
		if (!is_array($member) || !is_array($member['user'] ?? null)) {
			throw new \RuntimeException('Telegram user was not found in this group');
		}
		$isAdministrator = in_array($member['status'] ?? '', ['administrator', 'creator'], true);
		$administrator = null;
		if ($isAdministrator) {
			$rights = [];
			foreach (self::PROMOTABLE_RIGHTS as $right) {
				$rights[$right] = (bool)($member[$right] ?? false);
			}
			$administrator = [
				'adminLabel' => (string)($member['custom_title'] ?? ''),
				'isAnonymous' => (bool)($member['is_anonymous'] ?? false),
				'isEditable' => (bool)($member['can_be_edited'] ?? false),
				'rights' => $rights,
			];
		}
		return [
			'user' => $member['user'],
			'photo' => $this->profilePhoto($token, $identifier),
			'isAdministrator' => $isAdministrator,
			'administrator' => $administrator,
		];
	}

	/** @param array<string, bool> $rights */
	public function addAdministrator(string $token, string $chatId, string $userId, array $rights, string $label, bool $isAnonymous): void {
		foreach ($this->rawChatAdministrators($token, $chatId) as $member) {
			if ((string)($member['user']['id'] ?? '') === $userId) {
				throw new \RuntimeException('This Telegram user is already a group administrator');
			}
		}
		$assignableRights = array_flip($this->getAssignableAdministratorRights($token, $chatId));
		if ($assignableRights === []) {
			throw new \RuntimeException('Telegram does not allow this bot to add administrators');
		}
		$parameters = ['chat_id' => $chatId, 'user_id' => $userId, 'is_anonymous' => $isAnonymous];
		foreach (self::PROMOTABLE_RIGHTS as $right) {
			$parameters[$right] = isset($assignableRights[$right]) && ($rights[$right] ?? false);
		}
		$this->request($token, 'promoteChatMember', $parameters, true);
		if ($label !== '') {
			$this->request($token, 'setChatAdministratorCustomTitle', [
				'chat_id' => $chatId,
				'user_id' => $userId,
				'custom_title' => $label,
			], true);
		}
	}

	/** @return list<array<string, mixed>> */
	private function rawChatAdministrators(string $token, string $chatId): array {
		$result = $this->request($token, 'getChatAdministrators', ['chat_id' => $chatId]);
		if (!array_is_list($result)) {
			throw new \RuntimeException('Telegram Bot API returned an invalid administrator list');
		}
		return $result;
	}

	/** @return array<string, mixed> */
	private function findEditableAdministrator(string $token, string $chatId, string $userId): array {
		foreach ($this->rawChatAdministrators($token, $chatId) as $member) {
			if ((string)($member['user']['id'] ?? '') !== $userId) {
				continue;
			}
			if (($member['status'] ?? '') !== 'administrator' || !($member['can_be_edited'] ?? false)) {
				throw new \RuntimeException('Telegram does not allow this bot to edit that administrator');
			}
			return $member;
		}
		throw new \RuntimeException('Telegram administrator was not found');
	}

	private function assertValidMemberLabel(string $label): void {
		if (mb_strlen($label) > 16) {
			throw new \RuntimeException('Telegram member labels must be 16 characters or fewer');
		}
		if (preg_match('/[\p{Extended_Pictographic}\p{Regional_Indicator}\x{FE0F}\x{20E3}]/u', $label)) {
			throw new \RuntimeException('Telegram member labels cannot contain emoji');
		}
	}

	private function profilePhoto(string $token, string $userId): ?string {
		try {
			$photos = $this->request($token, 'getUserProfilePhotos', ['user_id' => $userId, 'limit' => 1]);
			$fileId = $photos['photos'][0][0]['file_id'] ?? null;
			if (!is_string($fileId) || $fileId === '') {
				return null;
			}
			$file = $this->request($token, 'getFile', ['file_id' => $fileId]);
			$filePath = $file['file_path'] ?? null;
			if (!is_string($filePath) || $filePath === '') {
				return null;
			}
			$response = $this->clientService->newClient()->get(
				self::API_ENDPOINT . '/file/bot' . rawurlencode($token) . '/' . str_replace('%2F', '/', rawurlencode($filePath)),
				['timeout' => 15],
			);
			return 'data:image/jpeg;base64,' . base64_encode((string)$response->getBody());
		} catch (\Throwable) {
			return null;
		}
	}

	/** @return array<string, mixed>|list<mixed>|bool */
	private function request(string $token, string $method, array $parameters = [], bool $post = false): array|bool {
		$token = trim($token);
		if ($token === '') {
			throw new \RuntimeException('Telegram Bot API key is not configured');
		}
		$query = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);
		$url = self::API_ENDPOINT . '/bot' . rawurlencode($token) . '/' . $method . ($query === '' ? '' : '?' . $query);
		try {
			$response = $post
				? $this->clientService->newClient()->post($url, ['timeout' => 15, 'http_errors' => false])
				: $this->clientService->newClient()->get($url, ['timeout' => 15, 'http_errors' => false]);
			$payload = json_decode((string)$response->getBody(), true, 512, JSON_THROW_ON_ERROR);
		} catch (\Throwable $exception) {
			throw new \RuntimeException('Could not reach the Telegram Bot API', 0, $exception);
		}
		if (!is_array($payload) || ($payload['ok'] ?? false) !== true) {
			$description = is_array($payload ?? null) ? trim((string)($payload['description'] ?? '')) : '';
			throw new \RuntimeException($description === '' ? 'Telegram Bot API request was rejected' : 'Telegram Bot API: ' . $description);
		}
		if (!array_key_exists('result', $payload)) {
			throw new \RuntimeException('Telegram Bot API response did not contain a result');
		}
		$result = $payload['result'];
		if (!is_array($result) && $result !== true) {
			throw new \RuntimeException('Telegram Bot API returned an unexpected ' . get_debug_type($result) . ' result');
		}
		return $result;
	}
}
