# Asset status

## Retirement dashboard

### Care-cost projection

The projection uses the saved annual nursing-home budget divided by twelve as
the fixed monthly bill. Medical and miscellaneous overhead is averaged across
completed calendar months from the first recorded Hongcheon month. Current-month
entries are excluded from the average. Missing months are listed explicitly and
remain part of the calendar denominator. Nursing-home bills, reimbursements and
support/awards are excluded from overhead; source-purpose totals remain expandable.

Three runway cards show liquid money, liquid money plus deposit principal,
and adding recorded BTC value. Housing is excluded from projections while retained
in the original asset graphs. Each card prominently shows years and months on the
same time scale. No future
interest, investment gain or inflation is assumed. Deposit maturity dates are
checked against liquid funds in the interactive bank scenario. Additional monthly
household use is a local simulation, not a write to
the asset plan or household ledger. The controls retain their values on refresh.

The default view is the retirement reconciliation dashboard. Its plan is stored
inside the existing encrypted asset document under `retirement`; personal amounts
are initialized in production, never embedded in public source. Original accounts,
the initial reconciliation baseline and recovery overrides are immutable after
initialization. Older record clients preserve the plan when saving other fields.
The original working document remains available in a collapsed archive.

`GET /asset-status/retirement-summary` combines the plan with read-only ledger
data fetched from the fixed household-finance transactions API. It includes all
`hongcheon` transactions and Hongcheon category variants. Only dated transactions
through today in Asia/Seoul count as actual payments. Source IDs, dates and memos
are retained; purpose groups are inferred from memos, not changes to the ledger.
Requests cache for one minute. Outages explicitly mark cached data stale; without
cached data, spending, holdings and gap calculations are withheld rather than zeroed.

At maturity on the Korean calendar, original deposits move from bank-held to
recovered. This is a date-based classification, not bank confirmation. Recovery
uses a recorded actual override where supplied; otherwise principal plus listed
interest is an estimate. Recovered funds enter calculated liquidity, never spending.
Holdings contain dated BTC valuations, housing deposits and liquid-account balances.
Later Hongcheon spending reduces calculated liquidity once. Confirming fresh
holdings establishes a new ledger/recovery snapshot without changing the original
baseline. The dashboard distinguishes snapshot account values from calculated
liquidity. Major payments and household transfers are separate from Hongcheon
payments; reconciliation assumptions remain visible. No household ledger writes
or database schema changes are used by the dashboard.

## Current access behavior

The Asset status page opens saved records directly, without a password, setup
code, recovery ticket, session cookie or automatic lock. Anyone with the app URL
can view it. The existing ASSET_STATUS_KEY and encrypted records are preserved;
do not replace the key. Access no longer depends on the legacy authentication
record being readable. Same-origin write checks, input validation, initial-import
overwrite prevention and revision checks still apply.

The page loads records on entry and when restored from browser history. Editing
and saving remain explicit. Legacy password endpoints remain for compatibility
with older maintenance tools but do not control record access.

## Historical password implementation (superseded)

The protected page is `/asset-status/`. It uses only first-party scripts and styles,
and loads financial records only after password authentication. It has no analytics,
third-party assets or browser storage. Before the first record is saved, an
authenticated owner can select the original workbook once. The raw request body
is parsed using BytesIO, without multipart upload spooling or saving the workbook.
The import control disappears after initial storage and refuses overwriting.

## Configuration

- The asset tab uses a dedicated shared password, independent of `ADMIN_PASSWORD`.
  Owner-only initial setup accepts an HMAC capability through a masked field,
  clears the field, and keeps it only in page memory; it never enters a URL.
  Setup is single-use and stores
  only a scrypt password hash inside encrypted storage. Authorized people can unlock
  with the same password. No records are accessible before setup.
- Configure a stable, random Fernet key as `ASSET_STATUS_KEY` in the app's Railway
  environment. Never print it, commit it, or regenerate it on restart. Losing or
  replacing this key makes the saved records unreadable. Password rotation does
  not change the data encryption key.
- Cookies are HttpOnly, SameSite Strict, and Secure in production. An additional
  token is kept only in the protected page's memory. Sessions expire after 15 minutes.
- The unlock rate limit permits five failed attempts per five minutes per IP per
  worker. This is bounded application-level protection, not a distributed firewall.

## Forgotten password recovery

An authorized repository owner can issue a 256-bit random recovery code and deploy
only its SHA-256 digest and Unix expiry in `asset_recovery.json`. Deliver the actual
code privately to the owner, never through GitHub, a URL, logs, or browser storage.
Use the protected page's “비밀번호를 잊으셨나요?” form to set a new password.
The code expires after its configured deadline and is consumed once under the
database transaction lock. Its used digest is retained in encrypted authentication
storage across restarts. Reset rotates the session identifier and invalidates old
sessions; it changes only the authentication record. Existing encrypted asset
records and `ASSET_STATUS_KEY` remain untouched. Missing, expired, malformed, and
used recovery tickets fail closed. Remove the expired ticket when practical.

## Persistence and migration

One encrypted JSON record is stored under the reserved `__private_asset_status__`
tab in the existing notes table. Public notes routes cannot read or modify this
record or the reserved `__private_asset_auth__` authentication record. No schema changes, personal source files, or plaintext records are needed
in the repository. Revision checks prevent overwriting another device's edits.

`import_asset_status.py` is a one-time maintenance tool. Its `--check-only` mode
reads the original workbook in memory, verifies field mappings and original totals,
and prints only a generic result. After an authorized deployment and security setup,
run it with the local workbook path, the verified production URL, and
`--configure-colors`. Names and the existing app password are entered with hidden
prompts, and are never written into code or command-line arguments. Initial import
refuses to overwrite an existing document and verifies the saved result in memory.
The optional `--owner-import` mode accepts a hidden owner capability instead of
the shared password. It only creates an absent record, cannot read records, and
returns a digest of the decrypted database record for in-memory verification.
It permits preparing encrypted content before the owner chooses their password.

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

All five sections support explicit edit mode and a local save button. Each save
commits the entire document with revision protection and returns sections to read
mode. Manual saves never validate the optional workbook picker. Export requires
authentication, streams a five-sheet XLSX from memory, and forces user-entered
strings to text cells. Print replaces controls with text only for the print layout.
All overall deposit rows are the canonical bond view; legacy independent bond rows
remain stored but are not counted again. Maturities before the current Korean date
appear under completed; strictly later dates appear under waiting, grouped by actual
maturity year. Today and missing dates appear separately for date review. Status
subtotals include principal plus interest. Annual maturity counts also use only the
canonical overall deposit rows. Export uses the same rules.

Movement candidates can reference an overall asset by `source_id`. Validation
copies source fields, rejects missing/duplicate references, and preserves a separate
review note. Movement references never enter the overall total. Existing rows link
only on a unique exact category/name/account/description/maturity match; unmatched
rows remain editable. Amount fields show thousands separators outside editing.
Overall assets are displayed as consumed (deposit maturity before 2026-06-01)
and held. The original overall total includes both; the separate held balance is
overall minus consumed principal. The same grouping and balances appear in export.

Run `python -m unittest -v test_asset_status` and JavaScript syntax checks. Browser
verification uses synthetic data only. Check password denial, lock/unlock, save and
reload, category choices, year regrouping, additions to all editable sections,
current-year maturity highlighting, name colors, and dependent sums. Do not capture
screenshots, response bodies, or console diagnostics containing real financial data.
