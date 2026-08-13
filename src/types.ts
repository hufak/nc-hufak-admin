export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

export interface JsonObject {
	[key: string]: JsonValue
}

export interface AdditionalAccountEntry {
	email?: string
	[key: string]: unknown
}

export interface IdentityEntry {
	Name?: string
	Email?: string
	email?: string
	signature?: string
	Signature?: string
	[key: string]: unknown
}

export interface MailboxUser {
	uid: string
	accountName?: string
	displayName?: string
	name?: string
	fullName?: string
	pronouns?: string
	pronoun?: string
	primaryEmail?: string
	apporderMatches?: boolean
	apporderDiff?: JsonObject | JsonValue[] | null
	apporder?: string
	dashboardLayout?: string
	dashboardLayoutMatches?: boolean
	lastActivityTs?: number | string | null
	failedLoginAttempts?: number | null
	additionalAccounts?: Record<string, AdditionalAccountEntry> | null
	identities?: IdentityEntry[] | Record<string, IdentityEntry> | null
	additionalAccountIdentities?: Record<string, IdentityEntry[] | Record<string, IdentityEntry>> | null
	additionalAccountsLookupError?: string
	identitiesLookupError?: string
	additionalAccountIdentitiesLookupErrors?: Record<string, string>
}

export interface DisabledUser {
	uid: string
}

export interface AdminStatusResponse {
	isAdmin?: boolean
}

export interface EmailDomainResponse {
	emailDomain?: string
}

export interface UserStatusResponse {
	users?: MailboxUser[]
	disabledUsers?: DisabledUser[]
	defaultApporder?: string
	defaultDashboardLayout?: string
}

export interface UserCreateResponse {
	username?: string
	message?: string
	password?: string
	welcomeEmailSent?: boolean
	welcomeEmailError?: string
}

export interface FreescoutUserResponse {
	message?: string
	email?: string
	freescoutRoot?: string
	exitCode?: number | string | null
	output?: string
	errorOutput?: string
}

export interface ApporderResetResponse {
	message?: string
}

export interface SnappyMailSettingsResponse {
	exitCode?: number | string | null
	output?: string
	errorOutput?: string
	message?: string
	identitiesFileMessage?: string
}

export interface SignatureTemplateResponse {
	template?: string
	message?: string
}

export interface ApporderSettingsResponse {
	apporder?: string
	message?: string
}

export interface DashboardLayoutSettingsResponse {
	dashboardLayout?: string
	message?: string
}

export interface SharedMailboxesResponse {
	sharedMailboxes?: Record<string, unknown>
	message?: string
}

export interface AdditionalAccountEmail {
	accountKey: string
	email: string
}

export interface NormalizedIdentityEntry {
	identityId: string
	name: string
	email: string
	signature: string
}

export interface DeleteEntryPayload {
	type: 'primaryEmail' | 'additionalEmail' | 'identity'
	uid: string
	email?: string
	accountKey?: string
	index?: number
	entry?: IdentityEntry | NormalizedIdentityEntry
	accountType?: 'primary'
}

export interface EditAccountPayload {
	type: 'primaryEmail' | 'additionalEmail' | 'identity'
	uid: string
	email?: string
	accountKey?: string
	index?: number
	entry?: IdentityEntry | NormalizedIdentityEntry
	accountType?: 'primary'
}

export interface SetIdentitySignaturePayload {
	uid: string
	accountKey?: string
	accountType?: 'primary'
	index: number
	entry: IdentityEntry | NormalizedIdentityEntry
	displayName: string
	signature: string
	prefix: string
	key: string
}

export interface SharedMailboxObjectNode {
	id: string
	key: string
	type: 'object'
	children: SharedMailboxNode[]
}

export interface SharedMailboxValueNode {
	id: string
	key: string
	type: 'value'
	value: string
}

export type SharedMailboxNode = SharedMailboxObjectNode | SharedMailboxValueNode

/** One option of a Tables `selection` column: cells store the option id, so the
 * label has to be looked up on the column. */
export interface TablesSelectionOption {
	id?: number | string
	label?: string
}

export interface TablesView {
	id: number
	title?: string
	description?: string
}

export interface TablesColumn {
	id: number
	title?: string
	type?: string
	selectionOptions?: TablesSelectionOption[] | null
}

export interface TablesCell {
	columnId: number
	value: JsonValue
}

export interface TablesRow {
	id: number
	/** only carries the cells that have a value, so it is keyed by column id */
	data?: TablesCell[] | null
}
