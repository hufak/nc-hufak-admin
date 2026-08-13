import { apiRequest } from '../api';
import type { JsonValue, TablesCell, TablesColumn, TablesRow, TablesView } from '../types';

interface TableApi {
	url: (path: string) => string
	headers?: Record<string, string>
	unwrap: (payload: unknown) => unknown
}

/** Tables answers on an OCS API (v2) and on the older index.php one (v1); which
 * of the two carries a given endpoint depends on the installed version, so each
 * request asks for the current flavour first and falls back to the legacy one. */
const TABLE_APIS: TableApi[] = [
	{
		url: (path) => `${OC.linkToOCS('apps/tables/api/2', 2)}${path}?format=json`,
		headers: { 'OCS-APIRequest': 'true' },
		unwrap: (payload) => (payload as { ocs?: { data?: unknown } } | null)?.ocs?.data,
	},
	{
		url: (path) => OC.generateUrl(`/apps/tables/api/1/${path}`),
		unwrap: (payload) => payload,
	},
];

const isList = <T>() => (payload: unknown): payload is T[] => Array.isArray(payload);
const isView = (payload: unknown): payload is TablesView =>
	typeof payload === 'object' && payload !== null && !Array.isArray(payload);

const fetchFromApis = async <T>(
	path: string,
	isValid: (payload: unknown) => payload is T,
): Promise<T> => {
	let lastError: unknown = new Error(`Failed to load ${path}`);
	for (const api of TABLE_APIS) {
		try {
			const payload = api.unwrap(
				await apiRequest<unknown>(api.url(path), { headers: api.headers }),
			);
			if (isValid(payload)) {
				return payload;
			}
			lastError = new Error(`Unexpected response for ${path}`);
		} catch (err) {
			lastError = err;
		}
	}
	throw lastError;
};

const formatValue = (value: JsonValue | undefined, column: TablesColumn): string => {
	if (value === null || value === undefined) {
		return '';
	}
	if (Array.isArray(value)) {
		return value.map((entry) => formatValue(entry, column)).filter((entry) => entry !== '').join(', ');
	}
	if (typeof value === 'object') {
		// user/group cells arrive as { id, type } objects
		const entry = value as Record<string, JsonValue>;
		const label = entry.displayName ?? entry.label ?? entry.title ?? entry.id;
		return label === null || label === undefined ? '' : String(label);
	}
	if (typeof value === 'boolean') {
		return value ? '✓' : '';
	}
	// selection cells store the option id, so resolve it against the column
	const option = column.selectionOptions?.find(({ id }) => String(id) === String(value));
	return option?.label ?? String(value);
};

interface TableViewRow {
	id: number
	cells: string[]
}

interface TableViewData {
	columns: TablesColumn[]
	rows: TableViewRow[]
}

interface TableViewMeta {
	title: string
	description: string
}

const buildRows = (columns: TablesColumn[], rows: TablesRow[]): TableViewRow[] =>
	rows.map((row) => {
		const cells = new Map<number, JsonValue>(
			(row.data ?? []).map((cell: TablesCell) => [cell.columnId, cell.value]),
		);
		return {
			id: row.id,
			cells: columns.map((column) => formatValue(cells.get(column.id), column)),
		};
	});

/** The columns and rows a view shows, in the order it shows them: which of them
 * a list displays is the view's business, never this app's. */
const fetchViewData = async (viewId: number): Promise<TableViewData> => {
	const [columns, rows] = await Promise.all([
		fetchFromApis(`views/${viewId}/columns`, isList<TablesColumn>()),
		fetchFromApis(`views/${viewId}/rows`, isList<TablesRow>()),
	]);
	return { columns, rows: buildRows(columns, rows) };
};

/** Title and description of a view. Both are decoration around the list itself,
 * so callers are expected to carry on when this one fails. */
const fetchViewMeta = async (viewId: number): Promise<TableViewMeta> => {
	const meta = await fetchFromApis(`views/${viewId}`, isView);
	return {
		title: typeof meta.title === 'string' ? meta.title.trim() : '',
		description: typeof meta.description === 'string' ? meta.description.trim() : '',
	};
};

export { fetchViewData, fetchViewMeta };
export type { TableViewData, TableViewMeta, TableViewRow };
