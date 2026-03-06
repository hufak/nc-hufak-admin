async function apiRequest(url, options = {}) {
	const { headers = {}, ...requestOptions } = options;
	const response = await fetch(url, {
		credentials: 'same-origin',
		...requestOptions,
		headers: {
			requesttoken: OC.requestToken,
			accept: 'application/json',
			...headers,
		},
	});
	if (!response.ok) {
		let message = `Unexpected status: ${response.status}`;
		try {
			const errorData = await response.json();
			if (typeof errorData?.message === 'string' && errorData.message.trim() !== '') {
				message = errorData.message;
			}
		} catch {
			// Keep default status message when error payload is not JSON.
		}
		throw new Error(message);
	}
	return response.json();
}

export { apiRequest };
