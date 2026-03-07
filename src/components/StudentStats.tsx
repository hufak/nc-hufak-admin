import type { ReactElement } from 'react';
import '../../studentstats2025/src/index.css';
import '../../studentstats2025/src/i18n';
import StudentStatsApp from '../../studentstats2025/src/App';

function StudentStats(): ReactElement {
	return <StudentStatsApp />;
}

export { StudentStats };
