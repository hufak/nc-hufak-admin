import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';

const rootElement = document.getElementById('hufak-root');
if (rootElement) {
	createRoot(rootElement).render(<App />);
}
