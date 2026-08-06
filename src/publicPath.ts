// on-demand chunks (the student stats React island) are served from the app's
// js folder, which is only known at runtime because of the Nextcloud webroot
declare let __webpack_public_path__: string;

const jsPath = OC.filePath('hufak', 'js', '');
__webpack_public_path__ = jsPath.endsWith('/') ? jsPath : `${jsPath}/`;

export {};
