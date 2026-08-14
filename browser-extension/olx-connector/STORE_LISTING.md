# Chrome Web Store submission — Talanty OLX.uz Connector

Use this file as the source of truth when completing the Chrome Web Store
developer dashboard. Do not add test credentials to the repository or listing.

## Store listing

- **Name:** Talanty — OLX.uz Connector
- **Summary:** Connects an OLX.uz account to Talanty after the user signs in on
  the official OLX.uz website.
- **Category:** Productivity
- **Language:** Russian
- **Visibility:** Unlisted
- **Regions:** Uzbekistan, or all regions if the dashboard does not offer the
  required regional choice
- **Pricing:** Free
- **Privacy-policy URL:**
  `https://admin.talanty.uz/privacy/olx-connector`
- **Homepage URL:** `https://admin.talanty.uz`
- **Support email:** use the monitored public support address owned by Talanty;
  verify it in the developer dashboard before submission

### Detailed description

Talanty — OLX.uz Connector lets a signed-in Talanty user connect their own
OLX.uz account from their normal Chrome browser. The user starts the connection
in Talanty, signs in and completes any verification only on the official OLX.uz
website, and explicitly confirms the connection there. Talanty can then perform
the OLX vacancy publication actions started by that user.

The connector does not read or send OLX passwords, CAPTCHA answers, SMS or OTP
codes, form contents, or API response bodies. It only transfers the OLX session
values and request metadata required for authenticated OLX requests to the
Talanty origin that created the short-lived, single-use connection ticket.

## Single purpose

Connect a user's OLX.uz account to Talanty so Talanty can perform the OLX
vacancy publication actions that user starts.

## Permission justifications

- **scripting:** Reads the signed-in OLX token records from OLX.uz first-party
  local storage only after the user explicitly confirms the connection.
- **storage:** Keeps the pending one-time connection request and captured OLX
  request context in Chrome session storage. It does not persist OLX credentials
  in extension local storage.
- **tabs:** Opens the official OLX.uz connection page, returns focus to the
  originating Talanty tab, and sends connection completion status to that tab.
- **webRequest:** Observes request headers only for `www.olx.uz/api/v1/*` to
  obtain the OLX device ID, request fingerprint, user agent, first-party cookie
  header, and a one-way digest used to match the active OLX token record. It
  does not read request bodies or response bodies.
- **`https://*.olx.uz/*`:** Runs the explicit confirmation UI on OLX.uz and
  reads the OLX-owned authenticated session values needed for the connection.
- **`https://*.talanty.uz/*`:** Receives a short-lived connection ticket from
  Talanty and sends the captured connection values only to the same Talanty
  origin.

## Data-use disclosure

Select the dashboard categories that cover all of the following data:

- Authentication information: OLX access, refresh, and identity tokens, plus
  the first-party OLX cookie header.
- Website content / browser storage: the OLX-owned Auth0 token records read from
  OLX.uz local storage.
- Web history or user activity, if the dashboard classifies the observed OLX
  API request URL and headers in either category.
- Device information: OLX device ID, request fingerprint, and user agent.

Certify only statements that match this implementation:

- Data is used only for the extension's single purpose.
- Data is not sold or used for advertising, creditworthiness, or unrelated
  profiling.
- Data is transmitted over HTTPS.
- The privacy notice clearly discloses the transfer before the user connects.

## Reviewer instructions

The reviewer needs a Talanty test account that can access Company settings and
a dedicated OLX.uz test account. Provide those credentials only in the private
Chrome Web Store reviewer-instructions fields.

1. Install the extension and sign in to the supplied Talanty test account.
2. Open **Company settings → OLX.uz account**.
3. Read the disclosure, select the consent checkbox, and press **Connect
   OLX.uz**.
4. Sign in to the supplied test OLX.uz account on the official site and complete
   any verification there.
5. Press **I am signed in — connect account** in the connector panel on OLX.uz.
6. Return to Talanty and verify that the OLX status is **Connected**.

Before submission, replace this paragraph in the private dashboard notes with
the exact test-account instructions and ensure neither test account requires an
unavailable employee-only verification step.

## Required media and final checks

- Upload `icons/icon128.png` as the store icon if the dashboard asks for it
  separately.
- Upload `store-assets/olx-connection-1280x800.png`. It shows the consent
  disclosure and connect action at the required 1280×800 size with the account
  phone fully masked and all unrelated personal details removed.
- Do not upload promotional images that imply an official OLX partnership.
- Confirm the production ZIP contains no localhost or `127.0.0.1` permissions.
- Confirm the deployed privacy URL is reachable without a Talanty login.
