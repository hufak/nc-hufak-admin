<?php

declare(strict_types=1);

namespace OCA\Hufak\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\ContentSecurityPolicy;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;

class PageController extends Controller {
	/** the student list section embeds this app, which is hosted on GitHub Pages */
	private const STUDENT_LIST_ORIGIN = 'https://hufak.github.io';

	public function __construct(string $appName, IRequest $request) {
		parent::__construct($appName, $request);
	}

	/**
	 * @NoAdminRequired
	 * @NoCSRFRequired
	 */
	public function index(): TemplateResponse {
		$response = new TemplateResponse('hufak', 'main');

		$csp = new ContentSecurityPolicy();
		$csp->addAllowedFrameDomain(self::STUDENT_LIST_ORIGIN);
		$response->setContentSecurityPolicy($csp);

		return $response;
	}
}
