<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';
import { styles } from '../styles';

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
const rowHeaderStyle: CSSProperties = { ...tableHeaderStyle, width: '1%' };

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
</script>

<template>
	<div v-if="isCompactTable" :style="tableWrapperStyle">
		<table :style="tableStyle">
			<thead>
				<tr>
					<th v-for="column in compactColumns" :key="column" scope="col" :style="tableHeaderStyle">
						{{ column === '_record' ? 'Record' : column }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, rowIndex) in compactRows" :key="rowIndex">
					<td v-for="column in compactColumns" :key="column" :style="tableCellStyle">
						{{ row[column] ?? '' }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
	<div v-else-if="isStructured" :style="tableWrapperStyle">
		<table :style="tableStyle">
			<tbody>
				<tr v-for="[key, entryValue] in entries" :key="key">
					<th scope="row" :style="rowHeaderStyle">{{ key }}</th>
					<td :style="tableCellStyle">
						<KasResponseTable v-if="entryValue !== null && typeof entryValue === 'object'" :value="entryValue" />
						<span v-else>{{ entryValue ?? '' }}</span>
					</td>
				</tr>
			</tbody>
		</table>
	</div>
	<span v-else>{{ value ?? '' }}</span>
</template>
