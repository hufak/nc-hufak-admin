function fullNameIsValid(value: string): boolean {
	return /^([A-Z][A-Za-z]*)( [A-Z][A-Za-z]*)+$/.test(value.trim());
}

function usernameFromFullName(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, '.');
}

function buildEmailFromUsername(username: string, emailDomain: string): string {
	return `${username}@${emailDomain}`;
}

export { fullNameIsValid, usernameFromFullName, buildEmailFromUsername };
