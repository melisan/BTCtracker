# Asset status

The protected page is `/asset-status/`. It uses only first-party scripts and styles,
and loads financial records only after password authentication. It has no analytics,
third-party assets, browser storage, or workbook upload widget.

## Configuration

- Keep the existing non-default `ADMIN_PASSWORD`. The feature fails closed when it
  is missing or still uses the legacy default.
- Configure a stable, random Fernet key as `ASSET_STATUS_KEY` in the app's Railway
  environment. Never print it, commit it, or regenerate it on restart. Losing or
  replacing this key makes the saved records unreadable. Password rotation does
  not change the data encryption key.
- Cookies are HttpOnly, SameSite Strict, and Secure in production. An additional
  token is kept only in the protected page's memory. Sessions expire after 15 minutes.
- The unlock rate limit permits five failed attempts per five minutes per IP per
  worker. This is bounded application-level protection, not a distributed firewall.

## Persistence and migration

One encrypted JSON record is stored under the reserved `__private_asset_status__`
tab in the existing notes table. Public notes routes cannot read or modify this
record. No schema changes, personal source files, or plaintext records are needed
in the repository. Revision checks prevent overwriting another device's edits.

`import_asset_status.py` is a one-time maintenance tool. Its `--check-only` mode
reads the original workbook in memory, verifies field mappings and original totals,
and prints only a generic result. After an authorized deployment and security setup,
run it with the local workbook path, the verified production URL, and
`--configure-colors`. Names and the existing app password are entered with hidden
prompts, and are never written into code or command-line arguments. Initial import
refuses to overwrite an existing document and verifies the saved result in memory.

The import maps the approved workbook structure:

- Overall assets: F3:F10 and F12:F13, excluding interest and other sections.
- Bonds: rows 18–22, initially grouped under 2025; users can select another year.
- Money to move: rows 26–28, presented as item, amount, and editable details.
- Future requirements: C34:C36; usable funds equal bond principal plus interest
  minus these requirements, matching the source D16 − C37.
- Expenses: rows 43 onward, presented as item, total amount, and editable contents.
  A blank miscellaneous item is added if it is absent.

Original calculated subtotals are reconciled and replaced by live sums rather than
being counted as assets. Newly added overall assets contribute to the overall total;
items in other sections remain separate. Workbook-specific names and balances are
not included in this source tree.

## Verification

Run `python -m unittest -v test_asset_status` and JavaScript syntax checks. Browser
verification uses synthetic data only. Check password denial, lock/unlock, save and
reload, category choices, year regrouping, additions to all editable sections,
current-year maturity highlighting, name colors, and dependent sums. Do not capture
screenshots, response bodies, or console diagnostics containing real financial data.
