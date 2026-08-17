<script setup lang="ts" generic="TRow">
import {
	getCoreRowModel,
	getSortedRowModel,
	useVueTable,
	type ColumnDef,
	type SortingState,
} from '@tanstack/vue-table';
import { computed, ref, type CSSProperties } from 'vue';

export interface SortableTableColumn<TRow> {
	id: string
	header: string
	accessor: (row: TRow) => unknown
	sortable?: boolean
}

const props = withDefaults(defineProps<{
	rows: TRow[]
	columns: SortableTableColumn<TRow>[]
	rowKey: (row: TRow, index: number) => string
	emptyMessage?: string
	showHeader?: boolean
	wrapperStyle?: CSSProperties
	tableStyle?: CSSProperties
	headerStyle?: CSSProperties
	cellStyle?: CSSProperties
}>(), {
	emptyMessage: 'No entries found.',
	showHeader: true,
});

const sorting = ref<SortingState>([]);
const columnDefinitions = computed<ColumnDef<TRow>[]>(() => props.columns.map((column) => ({
	id: column.id,
	header: column.header,
	accessorFn: column.accessor,
	enableSorting: column.sortable !== false,
})));
const table = useVueTable({
	get data() {
		return props.rows;
	},
	get columns() {
		return columnDefinitions.value;
	},
	getCoreRowModel: getCoreRowModel(),
	getSortedRowModel: getSortedRowModel(),
	getRowId: (row, index) => props.rowKey(row, index),
	state: {
		get sorting() {
			return sorting.value;
		},
	},
	onSortingChange: (updater) => {
		sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater;
	},
});

const headerGroups = computed(() => table.getHeaderGroups());
const tableRows = computed(() => table.getRowModel().rows);

const sortLabel = (columnId: string) => {
	const state = sorting.value.find((entry) => entry.id === columnId);
	return state ? (state.desc ? 'sorted descending' : 'sorted ascending') : 'not sorted';
};
</script>

<template>
	<div class="hufak-sortable-table" :style="wrapperStyle">
		<table :style="tableStyle">
			<thead v-if="showHeader">
				<tr v-for="headerGroup in headerGroups" :key="headerGroup.id">
					<th
						v-for="header in headerGroup.headers"
						:key="header.id"
						scope="col"
						:aria-sort="header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : 'none'"
						:style="headerStyle">
						<button
							v-if="header.column.getCanSort()"
							type="button"
							class="hufak-sortable-table__header-button"
							:title="`Sort ${String(header.column.columnDef.header)} (${sortLabel(header.column.id)})`"
							@click="header.column.toggleSorting()">
							{{ header.column.columnDef.header }}
							<span class="hufak-sortable-table__sort-icon" aria-hidden="true">{{ header.column.getIsSorted() === 'asc' ? '▲' : header.column.getIsSorted() === 'desc' ? '▼' : '↕' }}</span>
						</button>
						<template v-else>{{ header.column.columnDef.header }}</template>
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="row in tableRows" :key="row.id">
					<td v-for="cell in row.getVisibleCells()" :key="cell.id" :style="cellStyle">
						<slot name="cell" :row="cell.row.original" :column-id="cell.column.id" :value="cell.getValue()">
							{{ cell.getValue() ?? '' }}
						</slot>
					</td>
				</tr>
				<tr v-if="tableRows.length === 0">
					<td :style="cellStyle" :colspan="columns.length">{{ emptyMessage }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
.hufak-sortable-table {
	overflow-x: auto;
}

.hufak-sortable-table__header-button {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 0;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	font-weight: inherit;
	text-align: inherit;
	cursor: pointer;
}

.hufak-sortable-table__sort-icon {
	color: var(--color-text-maxcontrast);
	font-size: 11px;
}
</style>
