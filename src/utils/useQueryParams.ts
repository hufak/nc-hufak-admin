import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type WritableComputedRef } from 'vue';

/** Reactive query parameters that preserve unrelated application navigation parameters. */
export const useQueryParams = () => {
	const parameters = ref(new URLSearchParams(window.location.search));
	const refresh = () => { parameters.value = new URLSearchParams(window.location.search); };

	onMounted(() => window.addEventListener('popstate', refresh));
	onBeforeUnmount(() => window.removeEventListener('popstate', refresh));

	const update = (key: string, value: string, defaultValue: string) => {
		const next = new URLSearchParams(parameters.value);
		if (value === defaultValue) next.delete(key);
		else next.set(key, value);
		const pageUrl = new URL(window.location.href);
		pageUrl.search = next.toString();
		window.history.replaceState({}, '', pageUrl);
		parameters.value = next;
	};

	const string = (key: string, defaultValue: string): WritableComputedRef<string> => computed({
		get: () => parameters.value.get(key) ?? defaultValue,
		set: (value: string) => update(key, value, defaultValue),
	});

	const number = (key: string, defaultValue: number, isValid: (value: number) => boolean = Number.isFinite): WritableComputedRef<number> => computed({
		get: () => {
			const value = Number(parameters.value.get(key));
			return isValid(value) ? value : defaultValue;
		},
		set: (value: number) => update(key, String(value), String(defaultValue)),
	});

	const boolean = (key: string, defaultValue: boolean): WritableComputedRef<boolean> => computed({
		get: () => {
			const value = parameters.value.get(key);
			return value === 'true' ? true : value === 'false' ? false : defaultValue;
		},
		set: (value: boolean) => update(key, String(value), String(defaultValue)),
	});

	const enumValue = <T extends string>(key: string, defaultValue: T, values: readonly T[]): WritableComputedRef<T> => computed({
		get: () => {
			const value = parameters.value.get(key);
			return value !== null && values.includes(value as T) ? value as T : defaultValue;
		},
		set: (value: T) => update(key, value, defaultValue),
	});

	const hasAny = (keys: readonly string[]): ComputedRef<boolean> => computed(() =>
		keys.some((key) => parameters.value.has(key)),
	);

	return { string, number, boolean, enum: enumValue, hasAny };
};
