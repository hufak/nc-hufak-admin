import type { ReactElement } from 'react';
import { styles } from '../styles';
import type { SettingDiffRow } from '../utils/settingDiff';

interface SettingDiffPopoverProps {
	title: string
	entryHeader: string
	userLabel: string
	rows: SettingDiffRow[] | null
	userRaw: string
	defaultRaw: string
	top: number
	left: number
	width: number
	margin: number
	onClose: () => void
}

function SettingDiffPopover({
	title,
	entryHeader,
	userLabel,
	rows,
	userRaw,
	defaultRaw,
	top,
	left,
	width,
	margin,
	onClose,
}: SettingDiffPopoverProps): ReactElement {
	return (
		<>
			<div style={styles.popoverBackdrop} onMouseDown={onClose} role="presentation" />
			<div
				style={{
					...styles.popoverPanel,
					top: `${top}px`,
					left: `${left}px`,
					width: `${width}px`,
					maxHeight: `calc(100vh - ${top + margin}px)`,
				}}
			>
				<div style={styles.tooltipHeader}>
					<strong>{title}</strong>
					<button
						type="button"
						onClick={onClose}
						style={styles.inlineActionButton}
						aria-label="close diff"
						title="close diff"
					>
						<span className="icon icon-close" aria-hidden="true" style={styles.squareIcon} />
					</button>
				</div>
				{rows ? (
					<>
						<p style={{ ...styles.hintText, marginBottom: '6px' }}>
							Highlighted rows differ. Entries are sorted by their position.
						</p>
						<div style={styles.diffScroller}>
							<table style={styles.diffTable}>
								<thead>
									<tr>
										<th style={styles.diffTableHeader}>{entryHeader}</th>
										<th style={styles.diffTableHeader}>{userLabel}</th>
										<th style={styles.diffTableHeader}>default</th>
									</tr>
								</thead>
								<tbody>
									{rows.map((row) => (
										<tr key={row.key} style={row.differs ? styles.diffRowChanged : undefined}>
											<td style={styles.diffTableCell}>{row.key}</td>
											<td style={styles.diffTableCell}>{row.userValue ?? '—'}</td>
											<td style={styles.diffTableCell}>{row.defaultValue ?? '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				) : (
					<div style={styles.diffColumns}>
						<div>
							<p style={{ ...styles.hintText, marginBottom: '4px' }}>{userLabel}</p>
							<pre style={styles.tooltipPre}>{userRaw || '(empty)'}</pre>
						</div>
						<div>
							<p style={{ ...styles.hintText, marginBottom: '4px' }}>default</p>
							<pre style={styles.tooltipPre}>{defaultRaw || '(empty)'}</pre>
						</div>
					</div>
				)}
			</div>
		</>
	);
}

export { SettingDiffPopover };
