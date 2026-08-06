declare const OC: {
	requestToken: string
	generateUrl: (path: string) => string
	filePath: (app: string, type: string, file: string) => string
}

declare module '*.vue' {
	import type { DefineComponent } from 'vue';

	const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
	export default component;
}

declare module '@nextcloud/vue/components/*';
