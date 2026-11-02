# Formspree capabilities

Verified against official documentation on 2026-11-02. The supplied public endpoint is `https://formspree.io/f/mzeekake`; this does not identify the account plan or authorize reading messages. No account credentials were supplied, no account settings changed, and no real delivery is claimed.

| Capability | Classification | Evidence / consequence |
| --- | --- | --- |
| Read submissions | VERIFIED SUPPORTED; PLAN DEPENDENT | [Submissions API](https://help.formspree.io/articles/the-forms-api/form-submissions-api): Professional/Business. GET `/api/0/forms/<hashid>/submissions`. Account entitlement NOT VERIFIED. |
| Authentication | VERIFIED SUPPORTED | [Authentication](https://help.formspree.io/articles/the-forms-api/api-authentication): Basic or Bearer. Use Bearer only on the server. |
| Least-privilege key | VERIFIED SUPPORTED; PLAN DEPENDENT | [API keys](https://help.formspree.io/articles/the-forms-api/api-keys): enable HTTP API in form settings; use read-only key. A read-only key exposes submissions if published; keep it secret here. |
| List / pagination / historical fetch | VERIFIED SUPPORTED; PLAN DEPENDENT | [Submissions API](https://help.formspree.io/articles/the-forms-api/form-submissions-api): `since`, `limit`, `offset`, `order`, `spam`. Ascending batches can import history still retained by provider. Deleted/expired history NOT VERIFIED recoverable. |
| Delete / read flags / favorites / archives API | NOT VERIFIED | No operation-specific documented routes found in the reviewed Forms API docs. Master-key write capability alone does not establish these routes. Implement local metadata only; never guess internal endpoints. |
| Webhooks | VERIFIED SUPPORTED; PLAN DEPENDENT | [Webhooks](https://help.formspree.io/articles/plugins/webhooks): Professional/Business; simple POST has form, keys, submission with `_date` and fields. Owner entitlement NOT VERIFIED. Not used in selected API architecture. |
| Webhook retries | VERIFIED SUPPORTED | [Webhooks](https://help.formspree.io/articles/plugins/webhooks): respond 2xx within 3 seconds, otherwise up to 10 retries; consumers must be idempotent. |
| Signature / replay protection | VERIFIED SUPPORTED | [Signature verification](https://help.formspree.io/articles/advanced-features/verify-webhook-signatures): Formspree-Signature timestamp and v1 HMAC-SHA256 over timestamp + raw body; compare constant-time and enforce age window. Not implemented because API mode was selected. |
| Historical file export | VERIFIED SUPPORTED; PLAN DEPENDENT | [Export](https://help.formspree.io/articles/form-and-project-settings/exporting-submissions): CSV/JSON on Personal/Professional/Business. No file importer implemented. |
| Submission rate limit | VERIFIED SUPPORTED | [System limits](https://help.formspree.io/articles/form-and-project-settings/system-limits): 20 POSTs/minute; monthly quotas depend on plan; AJAX can return 429. |
| Read API rate quota | NOT VERIFIED | No numeric read quota found in reviewed docs. Honor 429 and Retry-After, bounded manual sync, no automatic retry storm. |
| Live access and E2E delivery for mzeekake | NOT VERIFIED | Requires owner configuration and one labeled real submission followed by authenticated import. Mock tests and OPTIONS do not establish delivery. |

## Selected behavior

Mode A is implemented behind configuration using the verified read API, with PostgreSQL synchronization and local management metadata. Mode C is the safe default until owner configures API access: authenticated setup notice, empty real-data store, no invented live letters. Test fixtures are explicitly test-only. Mode B is unnecessary and no webhook receiver is exposed. Unsupported and unverified are intentionally distinguished: absence of documentation is not proof that the provider cannot do something.
