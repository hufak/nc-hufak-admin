import type { FormEvent, ReactElement } from 'react';
import { MailboxCredentialsFields } from './MailboxCredentialsFields';
import { styles } from '../styles';

interface AccountCredentialsFormProps {
	title: string
	email: string
	password: string
	submitting: boolean
	status: string
	submitLabel: string
	emailInputId: string
	passwordInputId: string
	onEmailChange: (value: string) => void
	onPasswordChange: (value: string) => void
	onSubmit: (event: FormEvent<HTMLFormElement>) => void
	onCancel?: () => void
	showStatus?: boolean
	emailSuggestions?: string[]
	note?: string
	label?: string
	cancelLabel?: string
}

interface AccountCredentialsModalProps extends AccountCredentialsFormProps {
	onClose: () => void
}

function AccountCredentialsForm({
	title,
	email,
	password,
	submitting,
	status,
	submitLabel,
	emailInputId,
	passwordInputId,
	onEmailChange,
	onPasswordChange,
	onSubmit,
	onCancel,
	showStatus = true,
	emailSuggestions = [],
	note,
	label = 'Primary mailbox',
	cancelLabel = 'Cancel',
}: AccountCredentialsFormProps): ReactElement {
	return (
		<>
			<h4 style={styles.modalTitle}>{title}</h4>
			{note && <p style={styles.modalText}>{note}</p>}
			<form onSubmit={onSubmit} style={styles.form} autoComplete="off">
				<MailboxCredentialsFields
					label={label}
					emailId={emailInputId}
					passwordId={passwordInputId}
					emailName="hufak-set-mailbox-email"
					passwordName="hufak-set-mailbox-password"
					email={email}
					password={password}
					onEmailChange={onEmailChange}
					onPasswordChange={onPasswordChange}
					disabled={submitting}
					emailSuggestions={emailSuggestions}
				/>
				<div style={styles.modalButtonRow}>
					<button
						type="submit"
						disabled={submitting || !email || !password}
						style={styles.submitButton}
					>
						{submitting ? 'Setting...' : submitLabel}
					</button>
					{onCancel && (
						<button
							type="button"
							onClick={onCancel}
							style={styles.clearButton}
						>
							{cancelLabel}
						</button>
					)}
				</div>
				{showStatus && (
					<textarea
						readOnly
						value={status}
						name="hufak-set-mailbox-output"
						autoComplete="off"
						style={styles.outputBox}
						placeholder="Status output will appear here."
					/>
				)}
			</form>
		</>
	);
}

function AccountCredentialsModal({
	onClose,
	...formProps
}: AccountCredentialsModalProps): ReactElement {
	return (
		<div style={styles.modalBackdrop} onMouseDown={onClose} role="presentation">
			<div style={styles.modalCard} onMouseDown={(event) => event.stopPropagation()}>
				<AccountCredentialsForm {...formProps} />
			</div>
		</div>
	);
}

export { AccountCredentialsForm, AccountCredentialsModal };
