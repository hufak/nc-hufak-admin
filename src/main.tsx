import { createRoot } from 'react-dom/client';
import './vendor-nextcloud-vue.css';
import { App } from './components/App';

const rootElement = document.getElementById('hufak-root');
if (rootElement) {
	createRoot(rootElement).render(<App />);
}
