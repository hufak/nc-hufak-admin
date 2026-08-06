import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import '../../studentstats2025/src/index.css';

/** Mounts the React student stats app into a container owned by Vue.
 *
 * The app is built with Vite and resolves its CSV/JSON assets against
 * import.meta.env.BASE_URL, which webpack maps to window.__hufakAssetBase__
 * (see webpack.config.js). Nextcloud serves those assets through the
 * student-stats API route, whose URL is only known at runtime, so the base is
 * set here before the app module is evaluated. */
async function mountStudentStats(container: HTMLElement): Promise<() => void> {
	window.__hufakAssetBase__ = OC.generateUrl('/apps/hufak/api/student-stats/-').slice(0, -1);

	await import(/* webpackChunkName: "studentstats" */ '../../studentstats2025/src/i18n');
	const { default: StudentStatsApp } = await import(
		/* webpackChunkName: "studentstats" */ '../../studentstats2025/src/App'
	);

	const root = createRoot(container);
	root.render(createElement(StudentStatsApp));
	return () => root.unmount();
}

export { mountStudentStats };
