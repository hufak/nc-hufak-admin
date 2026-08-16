<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { apiRequest } from '../api';
import { styles } from '../styles';
import { SECTION_KEYS, buildSectionUrl, updateUrlSection } from '../constants';

const props = withDefaults(
	defineProps<{
		title: string
		settingName: string
		url: string
		payloadKey: string
		readValue: (data: Record<string, unknown>) => string
		validate: (value: string) => string
		placeholder: string
		rows?: number
	}>(),
	{ rows: 20 },
);

const value = ref('');
const loading = ref(true);
const saving = ref(false);
const status = ref('');
const validationMessage = computed(() => props.validate(value.value));
const canSave = computed(() => !loading.value && !saving.value && validationMessage.value === '');
const accountOverviewUrl = buildSectionUrl(SECTION_KEYS.ACCOUNT_OVERVIEW);
const textareaStyle = { ...styles.templateBox, fontFamily: 'monospace' };

onMounted(async () => {
	try {
		const data = await apiRequest<Record<string, unknown>>(OC.generateUrl(props.url));
		value.value = props.readValue(data);
		status.value = '';
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : `Failed to load ${props.settingName}`}`;
	} finally {
		loading.value = false;
	}
});

const goToAccountOverview = () => {
	updateUrlSection(SECTION_KEYS.ACCOUNT_OVERVIEW);
	window.dispatchEvent(new PopStateEvent('popstate'));
};

const save = async () => {
	const error = props.validate(value.value);
	if (error !== '') {
		status.value = `Error: ${error}`;
		return;
	}
	saving.value = true;
	status.value = `Saving ${props.settingName}...`;
	try {
		const body = new URLSearchParams({ [props.payloadKey]: value.value });
		const data = await apiRequest<Record<string, unknown>>(OC.generateUrl(props.url), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
			body,
		});
		const savedValue = props.readValue(data);
		if (savedValue !== '') {
			value.value = savedValue;
		}
		status.value =
			typeof data.message === 'string' && data.message !== ''
				? data.message
				: `${props.settingName} saved`;
	} catch (err) {
		status.value = `Error: ${err instanceof Error ? err.message : `Failed to save ${props.settingName}`}`;
	} finally {
		saving.value = false;
	}
};
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>{{ title }}</h2>
			<slot name="intro">
				<p :style="styles.introText">
					Changes to this setting only apply to newly created accounts. To roll them out to
					existing accounts, apply the {{ settingName }} per account in the
					<a :href="accountOverviewUrl" :style="styles.inlineLink" @click.prevent="goToAccountOverview">account overview</a>.
					Note that this overrides any changes those users may have made themselves.
				</p>
			</slot>
		</div>
		<form :style="styles.form" @submit.prevent="save">
			<textarea
				v-model="value"
				:style="textareaStyle"
				:placeholder="placeholder"
				:disabled="loading"
				:rows="rows" />
			<p v-if="validationMessage" :style="styles.validationMessage">{{ validationMessage }}</p>
			<button type="submit" :disabled="!canSave" :style="styles.submitButton">
				{{ saving ? 'Saving...' : `Save ${settingName}` }}
			</button>
			<p v-if="status" :style="styles.successMessage">{{ status }}</p>
		</form>
	</section>
</template>
