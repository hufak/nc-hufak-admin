<script setup lang="ts">
import { styles } from '../styles';

const STUDENT_LIST_URL = 'https://hufak.github.io/studentlist/';
</script>

<template>
	<section :style="styles.fullWidthSection">
		<div :style="styles.proseSectionContent">
			<h2>Student list</h2>
			<p :style="styles.introText">
				Filter and re-export the student list spreadsheet. This embeds the live version
				of
				<a :href="STUDENT_LIST_URL" target="_blank" rel="noreferrer" :style="styles.inlineLink">
					hufak.github.io/studentlist
				</a>; spreadsheets are processed in the browser and never uploaded.
			</p>
		</div>
		<iframe
			class="hufak-embed-frame"
			:src="STUDENT_LIST_URL"
			title="Student list"
			loading="lazy" />
	</section>
</template>

<style scoped>
.hufak-embed-frame {
	width: 100%;
	height: calc(100vh - var(--header-height, 50px) - 220px);
	min-height: 600px;
	border: 1px solid var(--color-border);
	border-radius: 8px;
	background: var(--color-main-background);
}
</style>
