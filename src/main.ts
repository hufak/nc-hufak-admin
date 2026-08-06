import { createApp } from 'vue';
import './publicPath';
import './vendor-nextcloud-vue.css';
import App from './components/App.vue';

const rootElement = document.getElementById('hufak-root');
if (rootElement) {
	createApp(App).mount(rootElement);
}
