<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { styles } from '../styles';
import SortableTable, { type SortableTableColumn } from './SortableTable.vue';

defineOptions({ name: 'KasResponseTable' });

const props = defineProps<{ value: unknown }>();
const tableWrapperStyle: CSSProperties = { ...styles.tableWrapper, display: 'block', width: '100%' };
const tableStyle: CSSProperties = { ...styles.table, width: '100%', tableLayout: 'auto' };
const wrappingCellStyle: CSSProperties = {
	maxWidth: '40ch',
	whiteSpace: 'normal',
	overflowWrap: 'break-word',
	wordBreak: 'normal',
};
const tableCellStyle: CSSProperties = { ...styles.tableCell, ...wrappingCellStyle };
const tableHeaderStyle: CSSProperties = { ...styles.tableHeader, ...wrappingCellStyle };

const presentation = computed(() =>
	props.value !== null && typeof props.value === 'object'
		? props.value as Record<string, unknown>
		: null,
);
const isCompactTable = computed(() =>
	presentation.value?._hufakPresentation === 'table'
	&& Array.isArray(presentation.value.columns)
	&& Array.isArray(presentation.value.rows),
);
const compactColumns = computed(() =>
	isCompactTable.value ? presentation.value?.columns as string[] : [],
);
const compactRows = computed(() =>
	isCompactTable.value ? presentation.value?.rows as Record<string, unknown>[] : [],
);
const compactTableColumns = computed<SortableTableColumn<Record<string, unknown>>[]>(() =>
	compactColumns.value.map((column) => ({
		id: column,
		header: column === '_record' ? 'Record' : column,
		accessor: (row) => row[column] ?? '',
	})),
);
const isStructured = computed(() => props.value !== null && typeof props.value === 'object');
const entries = computed(() => {
	if (Array.isArray(props.value)) {
		return props.value.map((value, index) => [String(index), value] as const);
	}
	if (props.value !== null && typeof props.value === 'object') {
		return Object.entries(props.value as Record<string, unknown>);
	}
	return [] as [string, unknown][];
});
const structuredRows = computed(() => entries.value.map(([key, value]) => ({ key, value })));
const structuredColumns: SortableTableColumn<{ key: string, value: unknown }>[] = [
	{ id: 'key', header: 'Field', accessor: (row) => row.key },
	{ id: 'value', header: 'Value', accessor: (row) => typeof row.value === 'string' || typeof row.value === 'number' ? row.value : '' },
];
</script>

<template>
	<SortableTable
		v-if="isCompactTable"
		:rows="compactRows"
		:columns="compactTableColumns"
		:row-key="(_, index) => String(index)"
		:wrapper-style="tableWrapperStyle"
		:table-style="tableStyle"
		:header-style="tableHeaderStyle"
		:cell-style="tableCellStyle" />
	<SortableTable
		v-else-if="isStructured"
		:rows="structuredRows"
		:columns="structuredColumns"
		:row-key="(row) => row.key"
		:wrapper-style="tableWrapperStyle"
		:table-style="tableStyle"
		:header-style="tableHeaderStyle"
		:cell-style="tableCellStyle">
		<template #cell="{ row, value, columnId }">
			<template v-if="columnId === 'value'">
				<KasResponseTable v-if="row.value !== null && typeof row.value === 'object'" :value="row.value" />
				<span v-else>{{ value ?? '' }}</span>
			</template>
			<template v-else>{{ value }}</template>
		</template>
	</SortableTable>
	<span v-else>{{ value ?? '' }}</span>
</template>
