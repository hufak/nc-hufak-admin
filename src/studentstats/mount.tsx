import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import '../../studentstats2025/src/index.css';
import '../../studentstats2025/src/i18n';
import StudentStatsApp from '../../studentstats2025/src/App';

/** Mounts the React student stats app into a container owned by Vue. */
function mountStudentStats(container: HTMLElement): () => void {
	const root = createRoot(container);
	root.render(createElement(StudentStatsApp));
	return () => root.unmount();
}

export { mountStudentStats };
