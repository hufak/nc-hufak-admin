function extractAdditionalAccountEmails(additionalAccounts) {
	if (!additionalAccounts || typeof additionalAccounts !== 'object') {
		return [];
	}

	return Object.entries(additionalAccounts)
		.map(([accountKey, entry]) => ({
			accountKey,
			email:
				entry && typeof entry === 'object' && typeof entry.email === 'string'
					? entry.email.trim()
					: '',
		}))
		.filter((entry) => entry.email !== '');
}

function extractIdentityEntries(identities) {
	if (!identities || typeof identities !== 'object') {
		return [];
	}

	const entries = Array.isArray(identities) ? identities : Object.values(identities);
	return entries
		.map((entry) => {
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
		.filter((entry) => entry !== null);
}

export { extractAdditionalAccountEmails, extractIdentityEntries };
