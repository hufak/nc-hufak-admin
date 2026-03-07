import type {
	AdditionalAccountEmail,
	IdentityEntry,
	NormalizedIdentityEntry,
} from '../types';

function extractAdditionalAccountEmails(
	additionalAccounts: Record<string, unknown> | null | undefined,
): AdditionalAccountEmail[] {
	if (!additionalAccounts || typeof additionalAccounts !== 'object') {
		return [];
	}

	return Object.entries(additionalAccounts)
		.map(([accountKey, entry]) => {
			const normalizedEntry =
				entry && typeof entry === 'object' ? (entry as { email?: unknown }) : null;
			return {
				accountKey,
				email:
					normalizedEntry && typeof normalizedEntry.email === 'string'
						? normalizedEntry.email.trim()
						: '',
			};
		})
		.filter((entry): entry is AdditionalAccountEmail => entry.email !== '');
}

function extractIdentityEntries(
	identities: IdentityEntry[] | Record<string, IdentityEntry> | null | undefined,
): NormalizedIdentityEntry[] {
	if (!identities || typeof identities !== 'object') {
		return [];
	}

	const entries = Array.isArray(identities) ? identities : Object.values(identities);
	return entries
		.map((entry): NormalizedIdentityEntry | null => {
			if (!entry || typeof entry !== 'object') {
				return null;
			}
			const name = typeof entry.Name === 'string' ? entry.Name.trim() : '';
			const email =
				typeof entry.Email === 'string'
					? entry.Email.trim()
					: typeof entry.email === 'string'
						? entry.email.trim()
						: '';
			const signature =
				typeof entry.signature === 'string'
					? entry.signature
					: typeof entry.Signature === 'string'
						? entry.Signature
						: '';
			if (!name && !email) {
				return null;
			}
			return { name, email, signature };
		})
		.filter((entry): entry is NormalizedIdentityEntry => entry !== null);
}

export { extractAdditionalAccountEmails, extractIdentityEntries };
