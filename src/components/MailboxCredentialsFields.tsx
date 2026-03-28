import type { ReactElement } from 'react';
import { styles } from '../styles';

interface MailboxCredentialsFieldsProps {
	label: string
	emailId: string
	passwordId: string
	emailName: string
	passwordName: string
	email: string
	password: string
	onEmailChange: (value: string) => void
	onPasswordChange: (value: string) => void
	disabled?: boolean
	emailPlaceholder?: string
	passwordPlaceholder?: string
	emailSuggestions?: string[]
}

function MailboxCredentialsFields({
	label,
	emailId,
	passwordId,
	emailName,
	passwordName,
	email,
	password,
	onEmailChange,
	onPasswordChange,
	disabled = false,
	emailPlaceholder = 'e-mail',
	passwordPlaceholder = 'Password',
	emailSuggestions = [],
}: MailboxCredentialsFieldsProps): ReactElement {
	const emailSuggestionsId = emailSuggestions.length > 0 ? `${emailId}-suggestions` : undefined;

	return (
		<>
			<label style={styles.fieldLabel} htmlFor={emailId}>
				{label}
			</label>
			<div style={styles.mailboxRow}>
				<input
					id={emailId}
					type="email"
					value={email}
					onChange={(event) => onEmailChange(event.target.value)}
					autoComplete="off"
					name={emailName}
					disabled={disabled}
					placeholder={emailPlaceholder}
					aria-label="email"
					list={emailSuggestionsId}
					style={{ ...styles.input, ...styles.addUserInput, maxWidth: 'none', minWidth: 0 }}
				/>
				{emailSuggestionsId && (
					<datalist id={emailSuggestionsId}>
						{emailSuggestions.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
					</datalist>
				)}
				<div className="hufak-mailbox-password-row">
					<input
						id={passwordId}
						type="password"
						value={password}
						onChange={(event) => onPasswordChange(event.target.value)}
						autoComplete="new-password"
						name={passwordName}
						disabled={disabled}
						placeholder={passwordPlaceholder}
						aria-label="password"
						style={{ ...styles.input, ...styles.addUserInput, maxWidth: 'none', minWidth: 0, margin: 0 }}
					/>
					<p className="hufak-mailbox-password-note" style={{ ...styles.hintText, margin: 0 }}>
						(copy password over from{' '}
						<a
							href="https://kas.all-inkl.com/email/email-account/"
							target="_blank"
							rel="noreferrer"
							style={styles.inlineLink}
						>
							kas.all-inkl.com
						</a>
						)
					</p>
				</div>
			</div>
		</>
	);
}

export { MailboxCredentialsFields };
