function fullNameIsValid(value) {
	return /^([A-Z][A-Za-z]*)( [A-Z][A-Za-z]*)+$/.test(value.trim());
}

function usernameFromFullName(value) {
	return value.trim().toLowerCase().replace(/\s+/g, '.');
}

function buildEmailFromUsername(username, emailDomain) {
	return `${username}@${emailDomain}`;
}

export { fullNameIsValid, usernameFromFullName, buildEmailFromUsername };
