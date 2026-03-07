function formatTimeSince(timestampSeconds: number | string | null | undefined): string {
	const ts = Number(timestampSeconds);
	if (!Number.isFinite(ts) || ts <= 0) {
		return 'never';
	}

	const diffSeconds = Math.max(0, Math.floor(Date.now() / 1000) - ts);
	if (diffSeconds < 60) {
		return 'just now';
	}

	const steps = [
		{ unit: 'year', seconds: 365 * 24 * 60 * 60 },
		{ unit: 'month', seconds: 30 * 24 * 60 * 60 },
		{ unit: 'day', seconds: 24 * 60 * 60 },
		{ unit: 'hour', seconds: 60 * 60 },
		{ unit: 'minute', seconds: 60 },
	];

	for (const step of steps) {
		if (diffSeconds >= step.seconds) {
			const value = Math.floor(diffSeconds / step.seconds);
			return `${value} ${step.unit}${value === 1 ? '' : 's'} ago`;
		}
	}

	return 'just now';
}

function isInactiveOverMonth(timestampSeconds: number | string | null | undefined): boolean {
	const ts = Number(timestampSeconds);
	if (!Number.isFinite(ts) || ts <= 0) {
		return true;
	}
	const nowSeconds = Math.floor(Date.now() / 1000);
	return nowSeconds - ts > 30 * 24 * 60 * 60;
}

export { formatTimeSince, isInactiveOverMonth };
