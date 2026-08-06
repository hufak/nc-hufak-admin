declare const OC: {
	requestToken: string
	generateUrl: (path: string) => string
	filePath: (app: string, type: string, file: string) => string
}

interface Window {
	/** base URL the embedded Vite apps resolve their static assets against */
	__hufakAssetBase__: string
}

declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
	export default component;
}

declare module '@nextcloud/vue/components/*';
