<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { styles } from '../styles';
import {
	htmlToPlainTextSignature,
	plainTextToHtmlSignature,
	serializeSignatureMarkup,
} from '../utils/signatureUtils';
import SignaturePreview from './SignaturePreview.vue';

const props = withDefaults(
	defineProps<{
		text: string
		useHtml: boolean
		disabled?: boolean
		textareaStyle?: CSSProperties
		textareaRows?: number
		placeholder?: string
	}>(),
	{
		disabled: false,
		textareaStyle: undefined,
		textareaRows: 12,
		placeholder: undefined,
	},
);

const emit = defineEmits<{
	(event: 'update:text', value: string): void
	(event: 'update:useHtml', value: boolean): void
}>();

const preview = computed(() => serializeSignatureMarkup(props.text, props.useHtml));

const onUseHtmlChange = (event: Event) => {
	const nextUseHtml = (event.target as HTMLInputElement).checked;
	emit(
		'update:text',
		nextUseHtml ? plainTextToHtmlSignature(props.text) : htmlToPlainTextSignature(props.text),
	);
	emit('update:useHtml', nextUseHtml);
};
</script>

<template>
	<div :style="styles.signatureEditorLayout">
		<div :style="styles.signatureEditorPane">
			<textarea
				:value="text"
				:style="textareaStyle || styles.modalTextarea"
				:rows="textareaRows"
				:placeholder="placeholder"
				:disabled="disabled"
				@input="emit('update:text', ($event.target as HTMLTextAreaElement).value)" />
			<label :style="styles.checkboxRow">
				<input
					type="checkbox"
					:checked="useHtml"
					:disabled="disabled"
					@change="onUseHtmlChange">
				<span :style="styles.fieldLabel">Use HTML signature</span>
			</label>
			<slot name="actions" />
		</div>
		<div :style="styles.signaturePreviewPane">
			<SignaturePreview :signature="preview" />
		</div>
	</div>
</template>
