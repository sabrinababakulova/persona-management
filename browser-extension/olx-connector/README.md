# Talanty olx.uz Connector

This Manifest V3 Chrome extension performs the one-time, user-controlled olx.uz
account connection. It does not collect the user's password, CAPTCHA, or SMS
code. Those values are entered only on the official olx.uz website.

The connector transfers the OLX access and refresh tokens plus the OLX-generated
device id, request fingerprint, user agent, and the allowlisted `deviceGUID` and
`access_token` cookies required by OLX's own authenticated requests. Its network listener is
limited to olx.uz API request headers. It hashes the active authorization token locally
only to select the matching OLX Auth0 cache entry; the request's authorization
header is never stored or transmitted. Form bodies and responses are ignored.
The connector never requests broad Chrome cookie access and does not keep the
connection values in persistent extension storage.

## Local installation

1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Choose this `browser-extension/olx-connector` directory.
5. Open Talanty company settings and click **Connect olx.uz**.

The extension accepts Persona connection requests only from HTTPS Talanty
subdomains and localhost development origins. A connection ticket expires after
15 minutes and can be consumed only once.

## Production distribution

Regular users must install the connector from its Chrome Web Store listing;
they do not need Developer mode or access to this repository. The production
package excludes all localhost permissions.

1. Run `bun run olx:extension:package` from the project root.
2. Upload `build/talanty-olx-connector-0.1.6.zip` in the Chrome Web Store
   developer dashboard.
3. Complete the listing with the answers in `STORE_LISTING.md` and use
   `https://admin.talanty.uz/privacy/olx-connector` as the privacy-policy URL.
4. Publish the extension as **Unlisted** unless public discovery is required.
5. After approval, set `NEXT_PUBLIC_OLX_CONNECTOR_URL` on the deployed Talanty
   application to the listing URL and rebuild/restart the app.

Each extension update requires a higher `version` in both manifest files and a
new ZIP. Keep the Chrome Web Store item ID unchanged by updating the existing
listing instead of creating a new item.
