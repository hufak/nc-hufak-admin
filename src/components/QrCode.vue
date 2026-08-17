<script setup lang="ts">
import QRCodeStyling, {
	type CornerDotType,
	type CornerSquareType,
	type DotType,
	type Gradient,
	type ShapeType,
} from 'qr-code-styling';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type WritableComputedRef } from 'vue';
import NcButton from '@nextcloud/vue/components/NcButton';
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch';
import NcColorPicker from '@nextcloud/vue/components/NcColorPicker';
import NcPopover from '@nextcloud/vue/components/NcPopover';
import NcSelect from '@nextcloud/vue/components/NcSelect';
import NcTextField from '@nextcloud/vue/components/NcTextField';
import { styles } from '../styles';
import { useQueryParams } from '../utils/useQueryParams';

const QR_SIZE = 320;
const LABEL_HEIGHT = 42;
const DEFAULT_URL = 'https://hufak.net';
const DEFAULT_LABEL = 'hufak.net';
const DEFAULT_LABEL_FONT = 'serif 16pt';
const DEFAULT_DOTS_STYLE: DotType = 'rounded';
const DEFAULT_CORNER_SQUARE_STYLE: CornerSquareType = 'extra-rounded';
const DEFAULT_CORNER_DOT_STYLE: CornerDotType = 'square';
const DEFAULT_SHAPE: ShapeType = 'square';
const DEFAULT_FOREGROUND_COLOR = '#000000';
const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_LOGO_FOREGROUND_COLOR = '#000000';
const DEFAULT_LOGO_BACKGROUND_COLOR = '#ffffff';
const DEFAULT_LOGO_SIZE = 0.25;

const dotStyleOptions: { value: DotType, label: string }[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'rounded', label: 'Rounded' },
	{ value: 'dots', label: 'Bubbly dots' },
	{ value: 'classy', label: 'Classy' },
	{ value: 'classy-rounded', label: 'Classy rounded' },
	{ value: 'extra-rounded', label: 'Extra rounded' },
];
const cornerSquareStyleOptions: { value: CornerSquareType, label: string }[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'extra-rounded', label: 'Extra rounded' },
	{ value: 'classy', label: 'Classy' },
	{ value: 'classy-rounded', label: 'Classy rounded' },
];
const cornerDotStyleOptions: { value: CornerDotType, label: string }[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'dot', label: 'Dot' },
	{ value: 'rounded', label: 'Rounded' },
];
const shapeOptions: { value: ShapeType, label: string }[] = [
	{ value: 'square', label: 'Square' },
	{ value: 'circle', label: 'Circle' },
];
const query = useQueryParams();
const url = query.string('qr-url', DEFAULT_URL);
const label = query.string('qr-label', DEFAULT_LABEL);
const labelFont = query.string('qr-label-font', DEFAULT_LABEL_FONT);
const selectedDotsStyle = query.enum('qr-dots', DEFAULT_DOTS_STYLE, dotStyleOptions.map((option) => option.value));
const selectedCornerSquareStyle = query.enum('qr-corner-square', DEFAULT_CORNER_SQUARE_STYLE, cornerSquareStyleOptions.map((option) => option.value));
const selectedCornerDotStyle = query.enum('qr-corner-dot', DEFAULT_CORNER_DOT_STYLE, cornerDotStyleOptions.map((option) => option.value));
const selectedShape = query.enum('qr-shape', DEFAULT_SHAPE, shapeOptions.map((option) => option.value));
const foregroundColor = query.string('qr-colour', DEFAULT_FOREGROUND_COLOR);
const backgroundColor = query.string('qr-background-colour', DEFAULT_BACKGROUND_COLOR);
const logoForegroundColor = query.string('qr-logo-foreground-colour', DEFAULT_LOGO_FOREGROUND_COLOR);
const logoBackgroundColor = query.string('qr-logo-background-colour', DEFAULT_LOGO_BACKGROUND_COLOR);
const logoSize = query.number('qr-logo-size', DEFAULT_LOGO_SIZE, (value) => value >= 0.1 && value <= 0.5);
const includeLogo = query.boolean('qr-logo', true);
const dotsGradientSpecification = query.string('qr-dots-gradient', '');
const cornerSquareGradientSpecification = query.string('qr-corner-square-gradient', '');
const cornerDotGradientSpecification = query.string('qr-corner-dot-gradient', '');
const backgroundGradientSpecification = query.string('qr-background-gradient', '');
type GradientTarget = 'dots' | 'cornerSquare' | 'cornerDot' | 'background';
const gradientSpecifications: Record<GradientTarget, WritableComputedRef<string>> = {
	dots: dotsGradientSpecification,
	cornerSquare: cornerSquareGradientSpecification,
	cornerDot: cornerDotGradientSpecification,
	background: backgroundGradientSpecification,
};
const QR_STYLE_PARAMETERS = ['qr-label-font', 'qr-dots', 'qr-corner-square', 'qr-corner-dot', 'qr-shape'];
const LOGO_PARAMETERS = ['qr-logo', 'qr-logo-foreground-colour', 'qr-logo-background-colour', 'qr-logo-size'];
const COLOUR_PARAMETERS = ['qr-colour', 'qr-background-colour', 'qr-dots-gradient', 'qr-corner-square-gradient', 'qr-corner-dot-gradient', 'qr-background-gradient'];
const showQrStyle = ref(query.hasAny(QR_STYLE_PARAMETERS).value);
const showLogo = ref(query.hasAny(LOGO_PARAMETERS).value);
const showColour = ref(query.hasAny(COLOUR_PARAMETERS).value);
const logoSvg = ref('');
const previewSvgDataUrl = ref('');
let qrCode: QRCodeStyling | null = null;
const optionValue = <T extends string>(option: { value: T }) => option.value;
const setForegroundColor = (color: string | undefined) => {
	foregroundColor.value = color || DEFAULT_FOREGROUND_COLOR;
};
const setBackgroundColor = (color: string | undefined) => {
	backgroundColor.value = color || DEFAULT_BACKGROUND_COLOR;
};
const setLogoColor = (color: string | undefined) => {
	logoForegroundColor.value = color || DEFAULT_LOGO_FOREGROUND_COLOR;
};
const setLogoBackgroundColor = (color: string | undefined) => {
	logoBackgroundColor.value = color || DEFAULT_LOGO_BACKGROUND_COLOR;
};
const parseGradientSpecification = (specification: string): Gradient | undefined => {
	if (specification.trim() === '') return undefined;
	try {
		const gradient: unknown = JSON.parse(specification);
		if (
			typeof gradient !== 'object'
			|| gradient === null
			|| !['linear', 'radial'].includes((gradient as Gradient).type)
			|| !Array.isArray((gradient as Gradient).colorStops)
			|| (gradient as Gradient).colorStops.length < 2
			|| !(gradient as Gradient).colorStops.every((stop) => typeof stop.offset === 'number' && typeof stop.color === 'string')
		) return undefined;
		return gradient as Gradient;
	} catch {
		return undefined;
	}
};
const dotsGradient = computed(() => parseGradientSpecification(dotsGradientSpecification.value));
const cornerSquareGradient = computed(() => parseGradientSpecification(cornerSquareGradientSpecification.value));
const cornerDotGradient = computed(() => parseGradientSpecification(cornerDotGradientSpecification.value));
const backgroundGradient = computed(() => parseGradientSpecification(backgroundGradientSpecification.value));
const hasBackgroundGradient = computed(() => backgroundGradientSpecification.value.trim() !== '');
const logoDataUrl = computed(() => !includeLogo.value || logoSvg.value === ''
	? ''
	: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(logoSvg.value.replace(/fill="#fff"/gi, `fill="${logoForegroundColor.value}"`))))}`);
const hasUrl = computed(() => url.value.trim() !== '');
const layoutStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
	gap: '24px',
	alignItems: 'start',
	maxWidth: '900px',
};
const previewCardStyle: CSSProperties = {
	display: 'grid',
	justifyItems: 'center',
	gap: '8px',
	padding: '16px',
	border: '1px solid var(--color-border)',
	borderRadius: '8px',
	background: 'var(--color-main-background)',
	minHeight: `${QR_SIZE + LABEL_HEIGHT + 32}px`,
	boxSizing: 'border-box',
};
const logoImageSize = computed(() => QR_SIZE * logoSize.value);
const logoPlateSize = computed(() => logoImageSize.value + 16);
const previewImageStyle: CSSProperties = { width: `${QR_SIZE}px`, maxWidth: '100%', display: 'block' };
const colourPickerTriggerStyle: CSSProperties = {
	display: 'inline-block',
	width: '16px',
	height: '16px',
	border: '1px solid var(--color-border)',
	borderRadius: '50%',
};
const colourControlsStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
	gap: '10px',
};
const tooltipContentStyle: CSSProperties = { margin: 0, maxWidth: '28ch' };
const sliderStyle: CSSProperties = { width: '100%', accentColor: 'var(--color-primary-element)' };
const gradientInputStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	alignItems: 'end',
	gap: '6px',
};

const parsedLabelFont = computed(() => {
	const size = labelFont.value.match(/\b\d+(?:\.\d+)?(?:pt|px|em|rem)\b/i)?.[0] || '16pt';
	const family = labelFont.value.replace(size, '').trim() || 'serif';
	return { family, size };
});

const randomGradient = (target: GradientTarget) => {
	const hue = Math.floor(Math.random() * 360);
	const secondHue = (hue + 45 + Math.floor(Math.random() * 180)) % 360;
	const lightness = target === 'background' ? 88 : 30;
	gradientSpecifications[target].value = JSON.stringify({
		type: Math.random() < 0.25 ? 'radial' : 'linear',
		rotation: Math.round(Math.random() * 628) / 100,
		colorStops: [
			{ offset: 0, color: `hsl(${hue} 70% ${lightness}%)` },
			{ offset: 1, color: `hsl(${secondHue} 70% ${lightness}%)` },
		],
	});
};

const clearGradient = (target: GradientTarget) => {
	gradientSpecifications[target].value = '';
};

const loadLogoDataUrl = async () => {
	try {
		const response = await fetch(OC.filePath('hufak', 'img', 'hufak.svg'));
		if (!response.ok) throw new Error('Could not load Hufak logo');
		logoSvg.value = await response.text();
	} catch (error) {
		console.warn('[hufak] QR code logo could not be embedded:', error);
	}
};

const updateQrCode = async () => {
	await nextTick();
	if (!qrCode) return;
	qrCode.update({
		data: url.value.trim() || ' ',
		shape: selectedShape.value,
		dotsOptions: { type: selectedDotsStyle.value, color: foregroundColor.value, gradient: dotsGradient.value },
		cornersSquareOptions: { type: selectedCornerSquareStyle.value, color: foregroundColor.value, gradient: cornerSquareGradient.value },
		cornersDotOptions: { type: selectedCornerDotStyle.value, color: foregroundColor.value, gradient: cornerDotGradient.value },
		backgroundOptions: { color: backgroundColor.value, gradient: backgroundGradient.value },
	});
	const svg = await composedSvg();
	previewSvgDataUrl.value = svg === null
		? ''
		: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
};

const escapeXml = (value: string) => value
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;');

const svgBackground = (color: string, gradient: Gradient | undefined) => {
	if (!gradient) return `<rect width="100%" height="100%" fill="${color}"/>`;
	const id = 'hufak-qr-background-gradient';
	const stops = gradient.colorStops
		.map((stop) => `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}"/>`)
		.join('');
	if (gradient.type === 'radial') {
		return `<defs><radialGradient id="${id}">${stops}</radialGradient></defs><rect width="100%" height="100%" fill="url(#${id})"/>`;
	}
	const angle = gradient.rotation || 0;
	const x = Math.cos(angle) * 50;
	const y = Math.sin(angle) * 50;
	return `<defs><linearGradient id="${id}" x1="${50 - x}%" y1="${50 - y}%" x2="${50 + x}%" y2="${50 + y}%">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#${id})"/>`;
};

const composedSvg = async (): Promise<string | null> => {
	if (!qrCode || !hasUrl.value) return null;
	const raw = await qrCode.getRawData('svg');
	if (!(raw instanceof Blob)) return null;
	const qrSvg = (await raw.text()).replace(/^<\?xml[^>]*>\s*/, '');
	const labelText = escapeXml(label.value.trim());
	const logoOffset = (QR_SIZE - logoPlateSize.value) / 2;
	const logo = logoDataUrl.value === ''
		? ''
		: `<rect x="${logoOffset}" y="${logoOffset}" width="${logoPlateSize.value}" height="${logoPlateSize.value}" rx="8" fill="${logoBackgroundColor.value}"/><image href="${logoDataUrl.value}" x="${logoOffset + 8}" y="${logoOffset + 8}" width="${logoImageSize.value}" height="${logoImageSize.value}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${QR_SIZE}" height="${QR_SIZE + LABEL_HEIGHT}" viewBox="0 0 ${QR_SIZE} ${QR_SIZE + LABEL_HEIGHT}">${svgBackground(backgroundColor.value, backgroundGradient.value)}${qrSvg}${logo}<text x="${QR_SIZE / 2}" y="${QR_SIZE + 26}" text-anchor="middle" font-family="${escapeXml(parsedLabelFont.value.family)}" font-size="${parsedLabelFont.value.size}" fill="${foregroundColor.value}">${labelText}</text></svg>`;
};

const downloadBlob = (blob: Blob, filename: string) => {
	const anchor = document.createElement('a');
	const objectUrl = URL.createObjectURL(blob);
	anchor.href = objectUrl;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(objectUrl);
};

const downloadSvg = async () => {
	const svg = await composedSvg();
	if (svg) downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'hufak-qr-code.svg');
};

const downloadPng = async () => {
	const svg = await composedSvg();
	if (!svg) return;
	const image = new Image();
	const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	image.onload = () => {
		const canvas = document.createElement('canvas');
		canvas.width = QR_SIZE * 3;
		canvas.height = (QR_SIZE + LABEL_HEIGHT) * 3;
		const context = canvas.getContext('2d');
		if (context) context.drawImage(image, 0, 0, canvas.width, canvas.height);
		URL.revokeObjectURL(objectUrl);
		canvas.toBlob((blob) => { if (blob) downloadBlob(blob, 'hufak-qr-code.png'); }, 'image/png');
	};
	image.onerror = () => URL.revokeObjectURL(objectUrl);
	image.src = objectUrl;
};

const updateDisclosure = (section: 'qrStyle' | 'logo' | 'colour') => (event: Event) => {
	const open = (event.currentTarget as HTMLDetailsElement).open;
	if (section === 'qrStyle') showQrStyle.value = open;
	else if (section === 'logo') showLogo.value = open;
	else showColour.value = open;
};

onMounted(async () => {
	await loadLogoDataUrl();
	qrCode = new QRCodeStyling({
		width: QR_SIZE,
		height: QR_SIZE,
		type: 'svg',
		margin: 12,
		data: ' ',
		qrOptions: { errorCorrectionLevel: 'H' },
		dotsOptions: { type: selectedDotsStyle.value, color: foregroundColor.value, gradient: dotsGradient.value },
		backgroundOptions: { color: backgroundColor.value, gradient: backgroundGradient.value },
	});
	await updateQrCode();
});

onBeforeUnmount(() => { qrCode = null; });
watch([url, label, labelFont, selectedDotsStyle, selectedCornerSquareStyle, selectedCornerDotStyle, selectedShape, foregroundColor, backgroundColor, logoBackgroundColor, dotsGradientSpecification, cornerSquareGradientSpecification, cornerDotGradientSpecification, backgroundGradientSpecification, logoDataUrl, logoSize, includeLogo], () => { void updateQrCode(); });
watch(query.hasAny(QR_STYLE_PARAMETERS), (hasSettings) => { if (hasSettings) showQrStyle.value = true; });
watch(query.hasAny(LOGO_PARAMETERS), (hasSettings) => { if (hasSettings) showLogo.value = true; });
watch(query.hasAny(COLOUR_PARAMETERS), (hasSettings) => { if (hasSettings) showColour.value = true; });
</script>

<template>
	<section :style="styles.formSection">
		<div :style="styles.proseContent">
			<h2>QR code generator</h2>
			<p :style="styles.hintText">Create a branded, downloadable QR code for a URL.</p>
		</div>
		<div :style="layoutStyle">
			<div :style="styles.form">
				<NcTextField v-model="url" label="URL" type="url" placeholder="https://example.org" autocomplete="url" />
				<NcTextField v-model="label" label="Label" type="text" placeholder="Optional label below the QR code" />
				<details :open="showQrStyle" :style="styles.collapsibleSection" @toggle="updateDisclosure('qrStyle')">
					<summary :style="styles.collapsibleSummary">QR style</summary>
					<div :style="styles.collapsibleContent">
					<NcTextField v-model="labelFont" label="Label font" type="text" placeholder="serif 16pt" />
					<NcSelect v-model="selectedDotsStyle" :options="dotStyleOptions" :reduce="optionValue" label="label" input-label="QR modules" :searchable="false" :clearable="false" />
					<NcSelect v-model="selectedCornerSquareStyle" :options="cornerSquareStyleOptions" :reduce="optionValue" label="label" input-label="Finder squares" :searchable="false" :clearable="false" />
					<NcSelect v-model="selectedCornerDotStyle" :options="cornerDotStyleOptions" :reduce="optionValue" label="label" input-label="Finder dots" :searchable="false" :clearable="false" />
					<NcSelect v-model="selectedShape" :options="shapeOptions" :reduce="optionValue" label="label" input-label="QR outline" :searchable="false" :clearable="false" />
					</div>
				</details>
				<details :open="showLogo" :style="styles.collapsibleSection" @toggle="updateDisclosure('logo')">
					<summary :style="styles.collapsibleSummary">Logo</summary>
					<div :style="styles.collapsibleContent">
						<NcCheckboxRadioSwitch v-model="includeLogo">Include logo</NcCheckboxRadioSwitch>
						<div>
							<label for="hufak-qr-logo-size" :style="styles.fieldLabel">Logo size: {{ Math.round(logoSize * 100) }}%</label>
							<input id="hufak-qr-logo-size" v-model.number="logoSize" type="range" min="0.1" max="0.5" step="0.01" :disabled="!includeLogo" :style="sliderStyle">
							<p :style="styles.hintText">Larger logos can reduce scan reliability; qr-code-styling recommends no more than 50%.</p>
						</div>
						<div :style="colourControlsStyle">
							<div>
								<label :style="styles.fieldLabel">Logo foreground colour</label>
								<NcColorPicker :model-value="logoForegroundColor" :advanced-fields="true" @update:model-value="setLogoColor">
									<template #default="{ attrs }">
										<NcButton v-bind="attrs" type="button" variant="secondary" :disabled="!includeLogo">
											<template #icon><span :style="{ ...colourPickerTriggerStyle, background: logoForegroundColor }" /></template>
											Pick
										</NcButton>
									</template>
								</NcColorPicker>
							</div>
							<div>
								<label :style="styles.fieldLabel">Logo background colour</label>
								<NcColorPicker :model-value="logoBackgroundColor" :advanced-fields="true" @update:model-value="setLogoBackgroundColor">
									<template #default="{ attrs }">
										<NcButton v-bind="attrs" type="button" variant="secondary" :disabled="!includeLogo">
											<template #icon><span :style="{ ...colourPickerTriggerStyle, background: logoBackgroundColor }" /></template>
											Pick
										</NcButton>
									</template>
								</NcColorPicker>
							</div>
						</div>
					</div>
				</details>
				<details :open="showColour" :style="styles.collapsibleSection" @toggle="updateDisclosure('colour')">
					<summary :style="styles.collapsibleSummary">Colour</summary>
					<div :style="styles.collapsibleContent">
						<div :style="colourControlsStyle">
						<div>
							<label :style="styles.fieldLabel">QR colour</label>
							<NcColorPicker :model-value="foregroundColor" :advanced-fields="true" @update:model-value="setForegroundColor">
								<template #default="{ attrs }">
									<NcButton v-bind="attrs" type="button" variant="secondary">
										<template #icon><span :style="{ ...colourPickerTriggerStyle, background: foregroundColor }" /></template>
										Pick
									</NcButton>
								</template>
							</NcColorPicker>
						</div>
						<div>
							<label :style="styles.fieldLabel">Background colour</label>
							<NcPopover v-if="hasBackgroundGradient" :triggers="['hover', 'focus']" placement="end" no-focus-trap>
								<template #trigger>
									<span tabindex="0" aria-label="Background colour is unavailable while a background gradient is set">
										<NcColorPicker :model-value="backgroundColor" :advanced-fields="true" @update:model-value="setBackgroundColor">
											<template #default="{ attrs }">
												<NcButton v-bind="attrs" type="button" variant="secondary" disabled>
													<template #icon><span :style="{ ...colourPickerTriggerStyle, background: backgroundColor }" /></template>
													Pick
												</NcButton>
											</template>
										</NcColorPicker>
									</span>
								</template>
								<p :style="tooltipContentStyle">Background colour is unavailable while a background gradient is set, because the gradient supplies the background instead.</p>
							</NcPopover>
							<NcColorPicker v-else :model-value="backgroundColor" :advanced-fields="true" @update:model-value="setBackgroundColor">
								<template #default="{ attrs }">
									<NcButton v-bind="attrs" type="button" variant="secondary">
										<template #icon><span :style="{ ...colourPickerTriggerStyle, background: backgroundColor }" /></template>
										Pick
									</NcButton>
								</template>
							</NcColorPicker>
						</div>
					</div>
					<div :style="gradientInputStyle">
						<NcTextField v-model="dotsGradientSpecification" label="QR modules gradient" type="text" placeholder='{"type":"linear","rotation":0,"colorStops":[{"offset":0,"color":"#123456"},{"offset":1,"color":"#789abc"}]}' trailing-button-icon="close" trailing-button-label="Clear QR modules gradient" :show-trailing-button="dotsGradientSpecification !== ''" @trailing-button-click="clearGradient('dots')" />
						<NcButton type="button" variant="secondary" aria-label="Create random QR modules gradient" @click="randomGradient('dots')"><template #icon><span aria-hidden="true">🎲</span></template></NcButton>
					</div>
					<div :style="gradientInputStyle">
						<NcTextField v-model="cornerSquareGradientSpecification" label="Finder squares gradient" type="text" placeholder='{"type":"linear","rotation":0,"colorStops":[{"offset":0,"color":"#123456"},{"offset":1,"color":"#789abc"}]}' trailing-button-icon="close" trailing-button-label="Clear finder squares gradient" :show-trailing-button="cornerSquareGradientSpecification !== ''" @trailing-button-click="clearGradient('cornerSquare')" />
						<NcButton type="button" variant="secondary" aria-label="Create random finder squares gradient" @click="randomGradient('cornerSquare')"><template #icon><span aria-hidden="true">🎲</span></template></NcButton>
					</div>
					<div :style="gradientInputStyle">
						<NcTextField v-model="cornerDotGradientSpecification" label="Finder dots gradient" type="text" placeholder='{"type":"linear","rotation":0,"colorStops":[{"offset":0,"color":"#123456"},{"offset":1,"color":"#789abc"}]}' trailing-button-icon="close" trailing-button-label="Clear finder dots gradient" :show-trailing-button="cornerDotGradientSpecification !== ''" @trailing-button-click="clearGradient('cornerDot')" />
						<NcButton type="button" variant="secondary" aria-label="Create random finder dots gradient" @click="randomGradient('cornerDot')"><template #icon><span aria-hidden="true">🎲</span></template></NcButton>
					</div>
					<div :style="gradientInputStyle">
						<NcTextField v-model="backgroundGradientSpecification" label="Background gradient" type="text" placeholder='{"type":"radial","colorStops":[{"offset":0,"color":"#ffffff"},{"offset":1,"color":"#dbeafe"}]}' trailing-button-icon="close" trailing-button-label="Clear background gradient" :show-trailing-button="backgroundGradientSpecification !== ''" @trailing-button-click="clearGradient('background')" />
						<NcButton type="button" variant="secondary" aria-label="Create random background gradient" @click="randomGradient('background')"><template #icon><span aria-hidden="true">🎲</span></template></NcButton>
					</div>
					<p :style="styles.hintText"><a href="https://github.com/kozakdenys/qr-code-styling#gradient-structure" target="_blank" rel="noreferrer">Gradient structure documentation</a></p>
					</div>
				</details>
			</div>
			<div :style="previewCardStyle">
				<img v-if="previewSvgDataUrl" :src="previewSvgDataUrl" alt="QR code preview" :style="previewImageStyle">
				<p v-else :style="styles.hintText">Enter a URL to generate a QR code.</p>
				<div :style="styles.buttonRow">
					<NcButton type="button" :disabled="!hasUrl" @click="downloadSvg">Download as SVG</NcButton>
					<NcButton type="button" :disabled="!hasUrl" @click="downloadPng">Download as PNG</NcButton>
				</div>
			</div>
		</div>
	</section>
</template>
