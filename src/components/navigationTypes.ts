interface NavigationEntry {
	key: string
	name: string
	/** Nextcloud icon class, used when the entry carries no path of its own */
	icon: string
	/** SVG path of an icon Nextcloud has no class for; takes precedence */
	iconPath?: string
	href: string
}

interface NavigationGroup {
	label?: string
	entries: NavigationEntry[]
}

export type { NavigationEntry, NavigationGroup };
