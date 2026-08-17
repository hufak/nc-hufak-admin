<?php

declare(strict_types=1);

namespace OCA\Hufak\Service;

use OCP\IConfig;
use OCP\Http\Client\IClientService;

/** Small, server-only client for the ALL-INKL KAS SOAP API. */
class KasMailClient {
	private const AUTH_ENDPOINT = 'https://kasapi.kasserver.com/soap/KasAuth.php';
	private const API_ENDPOINT = 'https://kasapi.kasserver.com/soap/KasApi.php';
	private const SOAP_ENVELOPE_NAMESPACE = 'http://schemas.xmlsoap.org/soap/envelope/';

	public function __construct(private IConfig $config, private IClientService $clientService) {
	}

	/**
	 * Creates a mailbox and returns only after KAS accepted the request.
	 * KAS credentials are intentionally read only from Nextcloud system config.
	 */
	public function createMailbox(
		string $localPart,
		string $domainPart,
		string $password,
		?string $providedLogin = null,
		?string $providedPassword = null,
	): void {
		try {
			[$login, $token] = $this->openSession($providedLogin, $providedPassword);
			$result = $this->request($login, $token, 'add_mailaccount', [
				'mail_password' => $password,
				'local_part' => $localPart,
				'domain_part' => $domainPart,
				'webmail_autologin' => 'N',
				'mail_xlist_enabled' => 'Y',
			]);
			$resultMessage = trim((string)$result);
			if (!in_array(strtolower($resultMessage), ['1', 'true'], true)) {
				throw new \RuntimeException(
					$resultMessage === ''
						? 'ALL-INKL did not confirm mailbox creation'
						: 'ALL-INKL mailbox creation was rejected: ' . $resultMessage,
				);
			}
		} catch (\JsonException $exception) {
			throw new \RuntimeException('Failed to prepare ALL-INKL mailbox request', 0, $exception);
		}
	}

	/** @return array<string, mixed> */
	public function getBasicStatistics(?string $providedLogin = null, ?string $providedPassword = null): array {
		try {
			[$login, $token] = $this->openSession($providedLogin, $providedPassword);
			// Keep this payload verbatim. KAS currently returns a line-oriented
			// non-JSON response for some accounts, and the frontend renders it in <pre>.
			$resources = $this->formatForPresentation(
				$this->request($login, $token, 'get_accountresources', [], true),
			);
			usleep(600000); // KAS reports a 0.5s flood-protection delay.
			$domains = $this->normaliseResult($this->request($login, $token, 'get_domains'));
			usleep(600000);
			$mailboxes = $this->normaliseResult($this->request($login, $token, 'get_mailaccounts'));
			return [
				'domainCount' => $this->countEntries($domains),
				'mailboxCount' => $this->countEntries($mailboxes),
				'resources' => $resources,
			];
		} catch (\JsonException $exception) {
			throw new \RuntimeException('Failed to prepare ALL-INKL KAS request', 0, $exception);
		}
	}

	/** Returns the parsed KAS mail-account map for display by an admin. */
	public function getMailAccounts(?string $providedLogin = null, ?string $providedPassword = null): mixed {
		try {
			[$login, $token] = $this->openSession($providedLogin, $providedPassword);
			return $this->formatForPresentation(
				$this->withoutRedundantMailForwardAddress(
					$this->request($login, $token, 'get_mailaccounts', [], true, true),
				),
			);
		} catch (\JsonException $exception) {
			throw new \RuntimeException('Failed to prepare ALL-INKL KAS request', 0, $exception);
		}
	}

	/** Returns the configured domain's mail forwards in the presentation format used by the admin UI. */
	public function getMailForwards(
		string $domain,
		?string $providedLogin = null,
		?string $providedPassword = null,
	): mixed {
		try {
			[$login, $token] = $this->openSession($providedLogin, $providedPassword);
			$forwards = $this->request($login, $token, 'get_mailforwards', [], true);
			return $this->formatForPresentation(
				$this->formatMailForwardTargetsForPresentation($this->withoutRedundantMailForwardAddress(
					$this->filterMailForwardsForDomain($forwards, $domain),
				)),
			);
		} catch (\JsonException $exception) {
			throw new \RuntimeException('Failed to prepare ALL-INKL KAS request', 0, $exception);
		}
	}

	/**
	 * Replaces the target list of an existing mail forward.
	 *
	 * The KAS API stores target addresses as a comma-separated string. The admin
	 * UI deliberately uses one address per line, so convert it only at this API
	 * boundary.
	 */
	public function updateMailForwardTargets(
		string $mailbox,
		string $mailForwardTargets,
		?string $providedLogin = null,
		?string $providedPassword = null,
	): void {
		try {
			[$login, $token] = $this->openSession($providedLogin, $providedPassword);
			$result = $this->request($login, $token, 'update_mailforward', [
				'mail_forward' => $mailbox,
				'mail_forward_targets' => $this->mailForwardTargetsForKas($mailForwardTargets),
			]);
			$resultMessage = trim((string)$result);
			if (!in_array(strtolower($resultMessage), ['1', 'true'], true)) {
				throw new \RuntimeException(
					$resultMessage === ''
						? 'ALL-INKL did not confirm the mail-forward update'
						: 'ALL-INKL mail-forward update was rejected: ' . $resultMessage,
				);
			}
		} catch (\JsonException $exception) {
			throw new \RuntimeException('Failed to prepare ALL-INKL mail-forward request', 0, $exception);
		}
	}
	public function mailboxCredentials(string $email): array {
		[$login, $token] = $this->openSession(null, null);
		$data = $this->request($login, $token, 'get_mailaccounts', [], true);
		return $this->findMailbox($data, strtolower($email)) ?? throw new \RuntimeException('Mailbox not found in KAS');
	}
	public function mailboxAddresses(): array {
		return $this->mailboxOptions()['mailboxes'];
	}
	/** @return array{mailboxes: list<string>, passwordAvailability: array<string, bool>} */
	public function mailboxOptions(): array {
		[$login, $token] = $this->openSession(null, null);
		$data = $this->request($login, $token, 'get_mailaccounts', [], true);
		$mailboxes = [];
		$this->collectMailboxes($data, $mailboxes);
		$mailboxes = array_values(array_unique($mailboxes));
		sort($mailboxes);
		$passwordAvailability = [];
		foreach ($mailboxes as $email) {
			$mailbox = $this->findMailbox($data, $email);
			$passwordAvailability[$email] = trim((string)($mailbox['mail_password'] ?? '')) !== '';
		}
		return ['mailboxes' => $mailboxes, 'passwordAvailability' => $passwordAvailability];
	}
	public function mailServerHost(): string {
		$login = trim((string)$this->config->getSystemValue('hufak_kas_login', ''));
		if ($login === '') {
			throw new \RuntimeException('ALL-INKL KAS credentials are not configured');
		}
		return $login . '.kasserver.com';
	}
	private function collectMailboxes(mixed $value, array &$result): void {
		if (!is_array($value)) return;
		$fields = [];
		foreach ($value as $key => $child) {
			$fields[strtolower((string)$key)] = $child;
		}
		$activeValue = $fields['mail_is_active'] ?? null;
		foreach (['mail_adresses', 'mail_addresses'] as $addressKey) {
			if (array_key_exists($addressKey, $fields)) {
				$this->collectActiveMailboxAddresses($fields[$addressKey], $activeValue, $result);
			}
		}
		foreach ($value as $child) {
			$this->collectMailboxes($child, $result);
		}
	}
	private function collectActiveMailboxAddresses(mixed $addresses, mixed $activeValue, array &$result): void {
		if (is_array($addresses) && is_array($activeValue)
			&& array_is_list($addresses) && array_is_list($activeValue)) {
			foreach ($addresses as $index => $address) {
				if (strtoupper(trim((string)($activeValue[$index] ?? ''))) === 'Y') {
					$this->collectAddressesFromMailAddressField($address, $result);
				}
			}
			return;
		}
		if ($this->containsActiveMailboxFlag($activeValue)) {
			$this->collectAddressesFromMailAddressField($addresses, $result);
		}
	}
	private function containsActiveMailboxFlag(mixed $value): bool {
		if (is_array($value)) {
			foreach ($value as $child) {
				if ($this->containsActiveMailboxFlag($child)) return true;
			}
			return false;
		}
		return strtoupper(trim((string)$value)) === 'Y';
	}
	private function collectAddressesFromMailAddressField(mixed $value, array &$result): void {
		if (is_string($value)) {
			preg_match_all('/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i', $value, $matches);
			foreach ($matches[0] as $address) $result[] = strtolower($address);
			return;
		}
		if (is_array($value)) foreach ($value as $child) $this->collectAddressesFromMailAddressField($child, $result);
	}
	private function findMailbox(mixed $value, string $email): ?array {
		if (!is_array($value)) return null;
		if (isset($value['mail_login']) && strtolower((string)$value['mail_login']) === $email) return $value;
		if (isset($value['email']) && strtolower((string)$value['email']) === $email) return $value;
		$fields = [];
		foreach ($value as $key => $child) {
			$fields[strtolower((string)$key)] = $child;
		}
		foreach (['mail_adresses', 'mail_addresses'] as $addressKey) {
			if (!array_key_exists($addressKey, $fields)) {
				continue;
			}
			$addresses = $fields[$addressKey];
			$passwords = $fields['mail_password'] ?? '';
			if (is_array($addresses) && array_is_list($addresses)) {
				foreach ($addresses as $index => $address) {
					if (!$this->mailAddressFieldContains($address, $email)) {
						continue;
					}
					$password = is_array($passwords) && array_is_list($passwords)
						? ($passwords[$index] ?? '')
						: $passwords;
					return ['mail_password' => $password];
				}
			} elseif ($this->mailAddressFieldContains($addresses, $email)) {
				return ['mail_password' => $passwords];
			}
		}
		foreach ($value as $key => $child) {
			if (strtolower((string)$key) === $email && is_array($child)) return $child;
			$found=$this->findMailbox($child,$email); if ($found!==null) return $found;
		}
		return null;
	}
	private function mailAddressFieldContains(mixed $value, string $email): bool {
		if (is_string($value)) {
			return str_contains(strtolower($value), $email);
		}
		if (is_array($value)) {
			foreach ($value as $child) {
				if ($this->mailAddressFieldContains($child, $email)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * KAS returns both records and parallel field arrays. Retain only records whose
	 * source forward address belongs to the selected domain, while preserving the
	 * surrounding shape so it can still be compacted into a dynamic table.
	 */
	private function filterMailForwardsForDomain(mixed $value, string $domain): mixed {
		if (!is_array($value)) {
			return null;
		}

		$fields = [];
		foreach ($value as $key => $child) {
			$fields[strtolower((string)$key)] = $child;
		}
		$forward = $fields['mail_forward'] ?? $fields['mail_forward_address'] ?? null;
		if (is_array($forward) && array_is_list($forward)) {
			$matchingIndexes = [];
			foreach ($forward as $index => $address) {
				if ($this->belongsToDomain($address, $domain)) {
					$matchingIndexes[] = $index;
				}
			}
			if ($matchingIndexes === []) {
				return null;
			}
			$filtered = [];
			foreach ($value as $key => $child) {
				$filtered[$key] = is_array($child) && array_is_list($child)
					? array_values(array_intersect_key($child, array_flip($matchingIndexes)))
					: $child;
			}
			return $filtered;
		}
		if ($this->belongsToDomain($forward, $domain)) {
			return $value;
		}

		$filtered = [];
		foreach ($value as $key => $child) {
			$matchingChild = $this->filterMailForwardsForDomain($child, $domain);
			if ($matchingChild !== null && $matchingChild !== []) {
				$filtered[$key] = $matchingChild;
			}
		}
		return $filtered === [] ? null : $filtered;
	}

	private function belongsToDomain(mixed $value, string $domain): bool {
		if (!is_string($value)) {
			return false;
		}
		return str_ends_with(strtolower(trim($value)), '@' . strtolower($domain));
	}

	/** KAS returns this misspelled field alongside the correctly named duplicate. */
	private function withoutRedundantMailForwardAddress(mixed $value): mixed {
		if (!is_array($value)) {
			return $value;
		}
		$cleaned = [];
		foreach ($value as $key => $child) {
			if (strtolower((string)$key) === 'mail_forward_adress') {
				continue;
			}
			$cleaned[$key] = $this->withoutRedundantMailForwardAddress($child);
		}
		return $cleaned;
	}

	/** Converts KAS's comma-separated forward targets to one target per line. */
	private function formatMailForwardTargetsForPresentation(mixed $value): mixed {
		if (!is_array($value)) {
			return $value;
		}

		foreach ($value as $key => $child) {
			if (strtolower((string)$key) === 'mail_forward_targets' && is_string($child)) {
				$value[$key] = implode("\n", array_map('trim', explode(',', $child)));
				continue;
			}
			$value[$key] = $this->formatMailForwardTargetsForPresentation($child);
		}
		return $value;
	}

	/** Converts one-target-per-line admin input to the KAS representation. */
	private function mailForwardTargetsForKas(string $targets): string {
		$lines = preg_split('/\R/', $targets) ?: [];
		return implode(',', array_values(array_filter(array_map('trim', $lines), static fn (string $line): bool => $line !== '')));
	}

	/** @return array{string, string} */
	private function openSession(?string $providedLogin, ?string $providedPassword): array {
		$usingProvidedCredentials = $providedLogin !== null || $providedPassword !== null;
		$login = $usingProvidedCredentials ? trim((string)$providedLogin) : trim((string)$this->config->getSystemValue('hufak_kas_login', ''));
		$kasPassword = $usingProvidedCredentials ? (string)$providedPassword : (string)$this->config->getSystemValue('hufak_kas_password', '');
		if ($login === '' || $kasPassword === '') {
			throw new \RuntimeException('ALL-INKL KAS credentials are not configured');
		}
		$token = trim($this->soapRequest(
			self::AUTH_ENDPOINT,
			'KasAuth',
			'urn:xmethodsKasApiAuthentication#KasAuth',
			'urn:xmethodsKasApiAuthentication',
			'Params',
			json_encode([
				'kas_login' => $login,
				'kas_auth_type' => 'plain',
				'kas_auth_data' => $kasPassword,
				'session_lifetime' => 120,
				'session_update_lifetime' => 'N',
			], JSON_THROW_ON_ERROR),
		));
		if ($token === '') {
			throw new \RuntimeException('ALL-INKL did not return a KAS session token');
		}
		return [$login, $token];
	}

	private function request(
		string $login,
		string $token,
		string $action,
		array $parameters = [],
		bool $preserveStructuredResult = false,
		bool $redactSensitiveFields = false,
	): mixed {
		return $this->soapRequest(
			self::API_ENDPOINT,
			'KasApi',
			'urn:xmethodsKasApi#KasApi',
			'urn:xmethodsKasApi',
			'Params',
			json_encode([
				'kas_login' => $login,
				'kas_auth_type' => 'session',
				'kas_auth_data' => $token,
				'kas_action' => $action,
				'KasRequestParams' => $parameters,
			], JSON_THROW_ON_ERROR),
			$preserveStructuredResult,
			$redactSensitiveFields,
		);
	}

	private function soapRequest(
		string $endpoint,
		string $operation,
		string $soapAction,
		string $operationNamespace,
		string $parameterName,
		string $parameterValue,
		bool $preserveStructuredResult = false,
		bool $redactSensitiveFields = false,
	): mixed {
		$escapedValue = htmlspecialchars($parameterValue, ENT_XML1 | ENT_QUOTES, 'UTF-8');
		$body = sprintf(
			'<?xml version="1.0" encoding="UTF-8"?>' .
			'<SOAP-ENV:Envelope xmlns:SOAP-ENV="%s" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">' .
			'<SOAP-ENV:Body><m:%s xmlns:m="%s"><%s xsi:type="xsd:string">%s</%s></m:%s></SOAP-ENV:Body></SOAP-ENV:Envelope>',
			self::SOAP_ENVELOPE_NAMESPACE,
			$operation,
			$operationNamespace,
			$parameterName,
			$escapedValue,
			$parameterName,
			$operation,
		);

		try {
			$response = $this->clientService->newClient()->post($endpoint, [
				'body' => $body,
				'headers' => [
					'Content-Type' => 'text/xml; charset=utf-8',
					'SOAPAction' => '"' . $soapAction . '"',
					'Accept' => 'text/xml',
				],
				'timeout' => 30,
			]);
			$xml = (string)$response->getBody();
		} catch (\Throwable $exception) {
			throw new \RuntimeException('Could not reach ALL-INKL KAS API: ' . $exception->getMessage(), 0, $exception);
		}

		$document = new \DOMDocument();
		if (!@$document->loadXML($xml, LIBXML_NONET)) {
			throw new \RuntimeException('ALL-INKL KAS API returned an invalid SOAP response');
		}
		$xpath = new \DOMXPath($document);
		$fault = $xpath->query('//*[local-name()="Fault"]/*[local-name()="faultstring"]')->item(0);
		if ($fault !== null) {
			throw new \RuntimeException('ALL-INKL KAS request failed: ' . trim($fault->textContent));
		}
		$result = $xpath->query('//*[local-name()="return" or local-name()="Result"]')->item(0);
		if ($result === null) {
			throw new \RuntimeException('ALL-INKL KAS API returned no result');
		}
		if (!$preserveStructuredResult) {
			return $result->textContent;
		}
		return $this->parseKasValue($result, $redactSensitiveFields);
	}

	private function parseKasValue(\DOMElement $element, bool $redactSensitiveFields = false): mixed {
		$items = $this->directChildElementsNamed($element, 'item');
		if ($items === []) {
			return $element->textContent;
		}

		$map = [];
		$list = [];
		$isMap = true;
		foreach ($items as $item) {
			$key = $this->directChildElementsNamed($item, 'key')[0] ?? null;
			$value = $this->directChildElementsNamed($item, 'value')[0] ?? null;
			if ($key === null || $value === null) {
				$isMap = false;
				break;
			}
			$keyName = $key->textContent;
			$parsedValue = $this->parseKasValue($value, $redactSensitiveFields);
			$map[$keyName] = $redactSensitiveFields && strtolower($keyName) === 'mail_password'
				? ($parsedValue === '' ? '' : '*')
				: $parsedValue;
		}
		if ($isMap) {
			return $map;
		}
		foreach ($items as $item) {
			$list[] = $this->parseKasValue($item, $redactSensitiveFields);
		}
		return $list;
	}

	/** @return list<\DOMElement> */
	private function directChildElementsNamed(\DOMElement $element, string $localName): array {
		$children = [];
		foreach ($element->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->localName === $localName) {
				$children[] = $child;
			}
		}
		return $children;
	}

	/**
	 * KAS often returns an associative collection of records with the same scalar
	 * fields. Mark only those unambiguous shapes for compact table rendering;
	 * irregular/nested values continue through the generic recursive renderer.
	 */
	private function formatForPresentation(mixed $value): mixed {
		if (!is_array($value)) {
			return $value;
		}

		$table = $this->buildCompactTable($value);
		if ($table !== null) {
			return $table;
		}

		foreach ($value as $key => $child) {
			$value[$key] = $this->formatForPresentation($child);
		}
		return $value;
	}

	/** @return array<string, mixed>|null */
	private function buildCompactTable(array $collection): ?array {
		if (count($collection) < 2) {
			return null;
		}
		$hasRecordKeys = !array_is_list($collection);
		$records = array_values($collection);
		foreach ($records as $record) {
			if (!is_array($record) || array_is_list($record) || $record === []) {
				return null;
			}
			foreach ($record as $fieldValue) {
				if (is_array($fieldValue) || is_object($fieldValue)) {
					return null;
				}
			}
		}

		$columns = [];
		foreach ($records as $record) {
			foreach (array_keys($record) as $column) {
				if (!in_array((string)$column, $columns, true)) {
					$columns[] = (string)$column;
				}
			}
		}
		if ($columns === []) {
			return null;
		}

		$rows = [];
		foreach ($collection as $recordKey => $record) {
			$row = [];
			if ($hasRecordKeys) {
				$row['_record'] = (string)$recordKey;
			}
			foreach ($columns as $column) {
				$row[$column] = $record[$column] ?? null;
			}
			$rows[] = $row;
		}

		return [
			'_hufakPresentation' => 'table',
			'columns' => $hasRecordKeys ? array_merge(['_record'], $columns) : $columns,
			'rows' => $rows,
		];
	}

	private function normaliseResult(mixed $result): mixed {
		if (is_string($result)) {
			$decoded = json_decode($result, true);
			return json_last_error() === JSON_ERROR_NONE ? $decoded : $result;
		}
		return $result;
	}

	private function countEntries(mixed $result): int {
		if (!is_array($result)) {
			return 0;
		}
		return count($result);
	}
}
