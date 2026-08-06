<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import AddAccount from './AddAccount.vue';
import ConfigureMail from './ConfigureMail.vue';
import Overview from './Overview.vue';
import AccountOverview from './AccountOverview.vue';
import MailboxConfig from './MailboxConfig.vue';
import SignatureTemplateDefaults from './SignatureTemplateDefaults.vue';
import AppOrderDefaults from './AppOrderDefaults.vue';
import DashboardWidgetDefaults from './DashboardWidgetDefaults.vue';
import StudentStats from './StudentStats.vue';
import StudentList from './StudentList.vue';
import AppNavigation from './AppNavigation.vue';
import type { NavigationGroup } from './navigationTypes';
import {
	buildSectionUrl,
	getConfigureMailUidFromUrl,
	parseSectionFromUrl,
	SECTION_GROUPS,
	SECTION_KEYS,
	SECTIONS,
	updateUrlSection,
} from '../constants';
import type { SectionKey } from '../constants';

const props = defineProps<{
	adminStatus: 'unknown' | 'admin' | 'non-admin'
	adminStatusError: string
	emailDomain: string
}>();

const emit = defineEmits<{ (event: 'update:emailDomain', value: string): void }>();

const selectedSection = ref<SectionKey>(parseSectionFromUrl());
const configureMailUid = ref(getConfigureMailUidFromUrl());

const isAdmin = computed(() => props.adminStatus === 'admin');
const visibleGroups = computed(() =>
	SECTION_GROUPS.filter((group) => !group.requiresAdmin || isAdmin.value),
);
const visibleSectionKeys = computed(
	() => new Set<SectionKey>(visibleGroups.value.flatMap((group) => [...group.items])),
);
const accessibleSectionKeys = computed(() => {
	const keys = new Set<SectionKey>(visibleSectionKeys.value);
	keys.add(SECTION_KEYS.OVERVIEW);
	if (isAdmin.value) {
		keys.add(SECTION_KEYS.CONFIGURE_MAIL);
	}
	return keys;
});
const currentSection = computed(() =>
	accessibleSectionKeys.value.has(selectedSection.value)
		? selectedSection.value
		: SECTION_KEYS.OVERVIEW,
);

const navigationGroups = computed<NavigationGroup[]>(() =>
	visibleGroups.value.map((group) => ({
		label: 'label' in group ? group.label : undefined,
		entries: group.items.flatMap((sectionKey) => {
			const section = SECTIONS.find(({ key }) => key === sectionKey);
			return section
				? [{
					key: section.key,
					name: section.label,
					icon: section.iconClass,
					href: buildSectionUrl(section.key),
				}]
				: [];
		}),
	})),
);

const navigationFooter = computed(() =>
	props.adminStatusError
		? `Failed to check administrator privileges: ${props.adminStatusError}`
		: undefined,
);

const handlePopState = () => {
	selectedSection.value = parseSectionFromUrl();
	configureMailUid.value = getConfigureMailUidFromUrl();
};

onMounted(() => window.addEventListener('popstate', handlePopState));
onBeforeUnmount(() => window.removeEventListener('popstate', handlePopState));

watch(
	() => [props.adminStatus, selectedSection.value] as const,
	() => {
		if (
			props.adminStatus === 'non-admin'
			&& selectedSection.value !== SECTION_KEYS.OVERVIEW
			&& !visibleSectionKeys.value.has(selectedSection.value)
		) {
			selectedSection.value = SECTION_KEYS.OVERVIEW;
			configureMailUid.value = '';
			updateUrlSection(SECTION_KEYS.OVERVIEW);
		}
	},
	{ immediate: true },
);

const selectSection = (section: SectionKey) => {
	selectedSection.value = section;
	updateUrlSection(section);
	if (section !== SECTION_KEYS.CONFIGURE_MAIL) {
		configureMailUid.value = '';
	}
};

const openConfigureMailForUser = (uid: string) => {
	if (!isAdmin.value) {
		return;
	}
	selectedSection.value = SECTION_KEYS.CONFIGURE_MAIL;
	configureMailUid.value = uid;
	updateUrlSection(SECTION_KEYS.CONFIGURE_MAIL, uid);
};
</script>

<template>
	<div class="hufak-admin-shell">
		<AppNavigation
			navigation-label="Sections"
			:groups="navigationGroups"
			:active-key="currentSection"
			:footer="navigationFooter"
			@select="selectSection($event as SectionKey)" />
		<main id="app-content-vue" class="app-content">
			<div class="hufak-admin-content">
				<Overview
					v-if="currentSection === SECTION_KEYS.OVERVIEW"
					:visible-section-keys="visibleSectionKeys" />
				<StudentList v-else-if="currentSection === SECTION_KEYS.STUDENT_LIST" />
				<StudentStats v-else-if="currentSection === SECTION_KEYS.STUDENT_STATS" />
				<AddAccount
					v-else-if="currentSection === SECTION_KEYS.ADD_ACCOUNT"
					:email-domain="emailDomain" />
				<ConfigureMail
					v-else-if="currentSection === SECTION_KEYS.CONFIGURE_MAIL"
					:preselected-uid="configureMailUid" />
				<MailboxConfig
					v-else-if="currentSection === SECTION_KEYS.MAILBOX_NAMES"
					:email-domain="emailDomain"
					@update:email-domain="emit('update:emailDomain', $event)" />
				<AccountOverview
					v-else-if="currentSection === SECTION_KEYS.ACCOUNT_OVERVIEW"
					@edit-mailbox="openConfigureMailForUser" />
				<SignatureTemplateDefaults
					v-else-if="currentSection === SECTION_KEYS.SIGNATURE_TEMPLATE" />
				<AppOrderDefaults v-else-if="currentSection === SECTION_KEYS.APP_ORDER" />
				<DashboardWidgetDefaults
					v-else-if="currentSection === SECTION_KEYS.DASHBOARD_WIDGETS" />
				<StudentStats v-else />
			</div>
		</main>
	</div>
</template>
