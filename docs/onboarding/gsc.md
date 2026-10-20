# Connect Google Search Console

You need a Google account that owns a Search Console property. This guide uses a service account and Google's authentication library, installed as an **example-only development dependency**. The reusable core still has no runtime dependencies.

## 1. Verify the website

Open [Search Console](https://search.google.com/search-console/), add your property, and complete its ownership verification:

- **Domain property:** covers the domain and its subdomains/protocols; verify the DNS record Google provides.
- **URL-prefix property:** use the exact protocol, host and path of the site; follow one of Google's offered verification methods.

Wait until the UI confirms ownership. Registering a property does not guarantee crawling or indexing. If you do not control the domain, ask its owner to grant access; do not create a different property merely to bypass a permission error.

Reference: [Google's property guide](https://support.google.com/webmasters/answer/34592).

## 2. Create an API identity

In [Google Cloud Console](https://console.cloud.google.com/):

1. Select or create a project you control.
2. Open **APIs & Services → Library**, find **Google Search Console API**, and enable it.
3. Open **IAM & Admin → Service Accounts → Create service account**.
4. Give it a descriptive name such as `search-observations`. Project-wide Editor/Owner roles are not needed for this example; Search Console access is granted separately.
5. Under that account's **Keys**, create a JSON key and download it yourself.
6. Move it to `.secrets/gsc-service-account.json` in your local clone, or another protected location outside the repository. Do not upload it to GitHub or the static site host.

Some organizations prohibit service-account keys. In that case use an organization-approved credential method with the Google auth library; do not disable the organization's restriction. The demo works without credentials.

## 3. Grant property access

Copy the service account's email from Cloud Console (it ends in `iam.gserviceaccount.com`). In Search Console select the exact property, then **Settings → Users and permissions → Add user**.

Start with **Restricted** access for reading performance data. The script requests only `webmasters.readonly` and checks the property permission. If a particular account configuration rejects a read, inspect the error and property membership before increasing access; ownership is not required for these API queries.

Cloud project membership and Search Console property access are separate. Enabling the API alone does not grant access to a website's data.

Reference: [Search Console permissions](https://support.google.com/webmasters/answer/7687615).

## 4. Configure the local clone

Edit `.env.local`:

```dotenv
SITE_URL=https://example.com/
SITE_LOCALE=es-MX
GSC_PROPERTY=sc-domain:example.com
GOOGLE_APPLICATION_CREDENTIALS=.secrets/gsc-service-account.json
GSC_COUNTRY=
GSC_DEVICE=
```

Replace `example.com` with your domain. For a URL-prefix property, copy its exact identifier instead:

```dotenv
GSC_PROPERTY=https://www.example.com/
```

`SITE_URL` must be inside that property. An `https://example.com/` property and an `https://www.example.com/` property are different. An internationalized domain can be copied in its ASCII/punycode form.

Finish [CMS setup](wordpress.md), then run `npm run onboarding:doctor` and `npm run onboarding:sync`. Authentication errors do not print the token, private key or remote response body.

## What the reader does

- Uses finalized web-search observations and Google's Pacific-time date boundary.
- Reads property-level daily totals to establish observed dates and the reporting denominator.
- Paginates query totals separately from query/page attribution; page impressions are not added to query demand.
- Applies the same optional country/device filters to every request.
- Leaves dates absent from Google's response absent, rather than fabricating complete coverage.
- Stops on failed requests. Top-row limits and omitted/anonymized queries remain limitations even after successful pagination.

The first sync reads a bounded window. It is a teaching adapter, not a high-volume warehouse importer. Do not schedule frequent full-window reads without adding incremental caching and quota handling.

References: [Search Analytics query contract](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [API limits](https://developers.google.com/webmaster-tools/limits), [Google authentication library](https://github.com/googleapis/google-auth-library-nodejs).

## Revoke or rotate later

Remove a service account's property access in Search Console when it no longer needs the data. Replace or delete its key in Cloud Console according to your organization's process. Update the local file path and rerun the doctor; never commit the replacement key.
