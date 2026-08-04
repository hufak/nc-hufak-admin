import type { ReactElement } from 'react';
import { styles } from '../styles';

interface SettingDiffCellProps {
	/** what the setting is called in button labels, e.g. "app order" */
	settingName: string
	uid: string
	matches: boolean
	busy: boolean
	inspectExpanded: boolean
	onInspect: (anchor: HTMLElement) => void
	onApplyDefault: () => void
	onPromoteToDefault: () => void
	applying: boolean
	promoting: boolean
}

function SettingDiffCell({
	settingName,
	uid,
	matches,
	busy,
	inspectExpanded,
	onInspect,
	onApplyDefault,
	onPromoteToDefault,
	applying,
	promoting,
}: SettingDiffCellProps): ReactElement {
	if (matches) {
		return (
			<span
				className="icon icon-checkmark"
				aria-label={`${settingName} matches default`}
			></span>
		);
	}

	return (
		<>
			<span
				className="icon icon-error"
				aria-label={`${settingName} differs from default`}
			></span>
			<button
				type="button"
				onClick={(event) => onInspect(event.currentTarget)}
				style={styles.inlineActionButton}
				aria-expanded={inspectExpanded}
				aria-label={`inspect difference to default ${settingName}`}
				title={`inspect difference to default ${settingName}`}
			>
				<span className="icon icon-toggle" aria-hidden="true" style={styles.squareIcon} />
			</button>
			<button
				type="button"
				onClick={onApplyDefault}
				disabled={busy}
				style={styles.inlineActionButton}
				aria-label={`apply default ${settingName}`}
				title={`apply default ${settingName}`}
			>
				<span
					className={`icon ${applying ? 'icon-loading-small' : 'icon-history'}`}
					aria-hidden="true"
					style={styles.squareIcon}
				/>
			</button>
			<button
				type="button"
				onClick={onPromoteToDefault}
				disabled={busy}
				style={styles.inlineActionButton}
				aria-label={`set this user's ${settingName} as the new global default ${settingName}`}
				title={`set ${uid}'s ${settingName} as the new global default ${settingName}`}
			>
				<span
					className={`icon ${promoting ? 'icon-loading-small' : 'icon-upload'}`}
					aria-hidden="true"
					style={styles.squareIcon}
				/>
			</button>
		</>
	);
}

export { SettingDiffCell };
