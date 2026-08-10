import { createApp } from 'vue';
import '../../studentstats2025/src/tokens.css';

/** Mounts the student stats app into a container owned by the admin panel.
 *
 * The app is built with Vite and resolves its CSV/JSON assets against
 * import.meta.env.BASE_URL, which webpack maps to window.__hufakAssetBase__
 * (see webpack.config.js). Nextcloud serves those assets through the
 * student-stats API route, whose URL is only known at runtime, so the base is
 * set here before the app module is evaluated.
 *
 * Only tokens.css is imported: the app's standalone.css carries body and *
 * rules that would leak into the surrounding Nextcloud UI. */
async function mountStudentStats(container: HTMLElement): Promise<() => void> {
	window.__hufakAssetBase__ = OC.generateUrl('/apps/hufak/api/student-stats/-').slice(0, -1);
	// tells the app's stylesheet that the host provides the page chrome
	document.documentElement.dataset.embed = '1';

	await import(/* webpackChunkName: "studentstats" */ '../../studentstats2025/src/i18n');
	const { default: StudentStatsApp } = await import(
		/* webpackChunkName: "studentstats" */ '../../studentstats2025/src/App.vue'
	);

	const app = createApp(StudentStatsApp);
	app.mount(container);
	return () => app.unmount();
}

export { mountStudentStats };
