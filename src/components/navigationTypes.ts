interface NavigationEntry {
	key: string
	name: string
	icon: string
	href: string
}

interface NavigationGroup {
	label?: string
	entries: NavigationEntry[]
}

export type { NavigationEntry, NavigationGroup };
