declare const OC: {
	requestToken: string
	generateUrl: (path: string) => string
	/** `<webroot>/ocs/v<version>.php/<service>/`, i.e. with a trailing slash */
	linkToOCS: (service: string, version: number) => string
	filePath: (app: string, type: string, file: string) => string
}

interface Window {
	/** base URL the embedded Vite apps resolve their static assets against */
	__hufakAssetBase__: string
}

/** The submodule apps are built by Vite and read import.meta.env.BASE_URL,
 * which webpack rewrites to window.__hufakAssetBase__ at build time. Declared
 * here because this build has no vite/client types of its own. */
interface ImportMeta {
	readonly env: {
		readonly BASE_URL: string
	}
}

declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
	export default component;
}

declare module '@nextcloud/vue/components/*';
