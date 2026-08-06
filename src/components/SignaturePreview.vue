<script setup lang="ts">
import { computed } from 'vue';
import { styles } from '../styles';

const props = defineProps<{ signature: string }>();

const htmlContent = computed(() =>
	props.signature.startsWith(':HTML:') ? props.signature.slice(6) : null,
);
</script>

<template>
	<div
		v-if="htmlContent !== null"
		class="hufak-signature-preview-html"
		:style="styles.signaturePreviewHtml"
		v-html="htmlContent" />
	<pre v-else :style="styles.signaturePreviewPre">{{ signature }}</pre>
</template>
