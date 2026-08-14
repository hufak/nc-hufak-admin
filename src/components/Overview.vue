<script setup lang="ts">
import { computed } from 'vue';
import { SECTION_GROUPS, SECTIONS } from '../constants';
import type { SectionKey } from '../constants';
import { styles } from '../styles';

const props = defineProps<{ visibleSectionKeys: ReadonlySet<SectionKey> }>();

const visibleGroups = computed(() => {
	const visibleSections = SECTIONS.filter((section) => props.visibleSectionKeys.has(section.key));
	return SECTION_GROUPS.map((group) => ({
		label: group.label,
		sections: group.items
			.map((sectionKey) => visibleSections.find(({ key }) => key === sectionKey))
			.filter((section): section is (typeof SECTIONS)[number] => Boolean(section)),
	})).filter((group) => group.sections.length > 0);
});
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>Hufak tools and settings</h2>
			<div v-for="group in visibleGroups" :key="group.label">
				<h3 :style="styles.subheading">{{ group.label }}</h3>
				<ul :style="styles.overviewList">
					<li v-for="section in group.sections" :key="section.key">
						<strong>{{ section.label }}</strong>: {{ section.description }}
					</li>
				</ul>
			</div>
		</div>
	</section>
</template>
