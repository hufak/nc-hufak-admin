interface SettingDiffRow {
	key: string
	userValue?: string
	defaultValue?: string
	differs: boolean
}

/** JSON object settings (app order) keep their entries, list settings (dashboard
 * widgets) become entries of widget id to position, so both diff the same way. */
function parseJsonObjectSetting(raw: string | undefined): Record<string, unknown> | null {
	if (typeof raw !== 'string' || raw.trim() === '') {
		return null;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function parseListSetting(raw: string | undefined): Record<string, unknown> | null {
	if (typeof raw !== 'string' || raw.trim() === '') {
		return null;
	}
	const entries = raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry !== '');
	if (entries.length === 0) {
		return null;
	}
	return Object.fromEntries(entries.map((entry, index) => [entry, index]));
}

function entryPosition(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const order = (value as Record<string, unknown>).order;
		if (typeof order === 'number' && Number.isFinite(order)) {
			return order;
		}
	}
	return Number.MAX_SAFE_INTEGER;
}

function buildSettingDiffRows(
	userSetting: Record<string, unknown>,
	defaultSetting: Record<string, unknown>,
): SettingDiffRow[] {
	const keys = Array.from(
		new Set([...Object.keys(userSetting), ...Object.keys(defaultSetting)]),
	);
	const rows = keys.map((key) => {
		const inUser = Object.prototype.hasOwnProperty.call(userSetting, key);
		const inDefault = Object.prototype.hasOwnProperty.call(defaultSetting, key);
		const userValue = inUser ? JSON.stringify(userSetting[key]) : undefined;
		const defaultValue = inDefault ? JSON.stringify(defaultSetting[key]) : undefined;
		return {
			key,
			userValue,
			defaultValue,
			differs: userValue !== defaultValue,
		};
	});

	return rows.sort((a, b) => {
		const positionA = Math.min(
			entryPosition(defaultSetting[a.key]),
			entryPosition(userSetting[a.key]),
		);
		const positionB = Math.min(
			entryPosition(defaultSetting[b.key]),
			entryPosition(userSetting[b.key]),
		);
		return positionA !== positionB ? positionA - positionB : a.key.localeCompare(b.key);
	});
}

export type { SettingDiffRow };
export { buildSettingDiffRows, parseJsonObjectSetting, parseListSetting };
