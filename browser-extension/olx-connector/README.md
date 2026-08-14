# Talanty OLX.uz Connector

This Manifest V3 Chrome extension performs the one-time, user-controlled OLX.uz
account connection. It does not collect the user's password, CAPTCHA, or SMS
code. Those values are entered only on the official OLX.uz website.

The connector transfers the OLX access, refresh, and identity tokens plus the
OLX-generated device id, request fingerprint, user agent, and first-party cookie
header required by OLX's own authenticated requests. Its network listener is
limited to OLX.uz API request headers. It hashes the active authorization token locally
only to select the matching OLX Auth0 cache entry; the request's authorization
header is never stored or transmitted. Form bodies and responses are ignored.
The connector never requests broad Chrome cookie access and does not keep the
connection values in persistent extension storage.

## Local installation

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Choose this `browser-extension/olx-connector` directory.
5. Open Talanty company settings and click **Connect OLX.uz**.

The extension accepts Persona connection requests only from HTTPS Talanty
subdomains and localhost development origins. A connection ticket expires after
15 minutes and can be consumed only once.
