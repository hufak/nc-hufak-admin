<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import Overview from './Overview.vue';
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

// Sections are mutually exclusive, so loading them eagerly puts code for every
// admin tool in the initial download. Keep the shell and navigation immediate,
// but fetch each tool only when its section is selected.
const AddAccount = defineAsyncComponent(() => import(/* webpackChunkName: "add-account" */ './AddAccount.vue'));
const ConfigureMail = defineAsyncComponent(() => import(/* webpackChunkName: "configure-mail" */ './ConfigureMail.vue'));
const AccountOverview = defineAsyncComponent(() => import(/* webpackChunkName: "account-overview" */ './AccountOverview.vue'));
const MailboxConfig = defineAsyncComponent(() => import(/* webpackChunkName: "mailbox-config" */ './MailboxConfig.vue'));
const SignatureTemplateDefaults = defineAsyncComponent(() => import(/* webpackChunkName: "signature-template" */ './SignatureTemplateDefaults.vue'));
const AccountInfoTemplate = defineAsyncComponent(() => import(/* webpackChunkName: "account-info-template" */ './NewAccountTemplate.vue'));
const AppOrderDefaults = defineAsyncComponent(() => import(/* webpackChunkName: "app-order" */ './AppOrderDefaults.vue'));
const DashboardWidgetDefaults = defineAsyncComponent(() => import(/* webpackChunkName: "dashboard-widgets" */ './DashboardWidgetDefaults.vue'));
const StudentStats = defineAsyncComponent(() => import(/* webpackChunkName: "student-stats-section" */ './StudentStats.vue'));
const StudentList = defineAsyncComponent(() => import(/* webpackChunkName: "student-list" */ './StudentList.vue'));
const ContactList = defineAsyncComponent(() => import(/* webpackChunkName: "contact-list" */ './ContactList.vue'));
const KasTest = defineAsyncComponent(() => import(/* webpackChunkName: "kas-test" */ './KasTest.vue'));
const EmailForwards = defineAsyncComponent(() => import(/* webpackChunkName: "email-forwards" */ './EmailForwards.vue'));

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
					iconPath: 'iconPath' in section ? section.iconPath : undefined,
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
				<ContactList v-else-if="currentSection === SECTION_KEYS.CONTACT_LIST" />
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
				<AccountInfoTemplate
					v-else-if="currentSection === SECTION_KEYS.ACCOUNT_INFO_TEMPLATE" />
				<AppOrderDefaults v-else-if="currentSection === SECTION_KEYS.APP_ORDER" />
				<DashboardWidgetDefaults
					v-else-if="currentSection === SECTION_KEYS.DASHBOARD_WIDGETS" />
				<KasTest v-else-if="currentSection === SECTION_KEYS.KAS_TEST" />
				<EmailForwards v-else-if="currentSection === SECTION_KEYS.EMAIL_FORWARDS" />
				<StudentStats v-else />
			</div>
		</main>
	</div>
</template>
