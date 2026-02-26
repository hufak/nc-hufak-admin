<?php

declare(strict_types=1);

namespace OCA\Hufak\AppInfo;

use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

class Application extends App implements IBootstrap {
	public const APP_ID = 'hufak';

	public function __construct(array $urlParams = []) {
		parent::__construct(self::APP_ID, $urlParams);
	}

	public function register(IRegistrationContext $context): void {
		// Registration hooks are not needed for this app yet.
	}

	public function boot(IBootContext $context): void {
		// Navigation is declared in appinfo/info.xml.
	}
}
