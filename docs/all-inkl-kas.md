# ALL-INKL KAS mailbox provisioning

The app reads the KAS credentials from **Nextcloud system configuration**, not app configuration. They are only used in `KasMailClient` on the server and are never sent to a browser.

Add the values to Nextcloud's `config/config.php`, preferably from secrets injected by the host:

```php
'hufak_kas_login' => getenv('Hufak_KAS_LOGIN') ?: '',
'hufak_kas_password' => getenv('Hufak_KAS_PASSWORD') ?: '',
```

The PHP-FPM/Apache service must receive both environment variables. Do not put them in `.env` files served by the web server, browser-visible app configuration, or `occ config:app:set` values.

The Nextcloud server must be allowed to make outbound HTTPS connections to `https://kasapi.kasserver.com`. The app sends SOAP XML through Nextcloud's HTTP client directly, so it does not download or parse KAS WSDL files and does not require PHP's SOAP extension.

For each mailbox, the app opens a short-lived (120 second) KAS session: it calls `KasAuth` with the KAS login and password, receives a session token, then sends `add_mailaccount` to `KasApi` using that token. The token and KAS password remain in PHP process memory only.

Use a dedicated KAS credential with only the scope needed for mailbox administration when the ALL-INKL account arrangement allows it. The KAS API request creates a mailbox with a separately generated password; that password is shown to the administrator once in the creation output and is then used to configure NextSnapMail.
