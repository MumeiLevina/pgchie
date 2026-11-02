class Formspree {
  constructor(config, fetcher = fetch) { this.config = config; this.fetcher = fetcher; }
  get configured() { return this.config.mode === 'api' && Boolean(this.config.apiToken); }
  async page(offset) {
    if (!this.configured) throw Object.assign(new Error('Integration not configured'), { status: 503, code: 'integration_not_configured' });
    const url = new URL(`https://formspree.io/api/0/forms/${this.config.formId}/submissions`);
    url.search = new URLSearchParams({ limit: '100', offset: String(offset), order: 'asc', spam: 'false' }).toString();
    let response;
    try {
      response = await this.fetcher(url, { headers: { Authorization: `Bearer ${this.config.apiToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(12000), redirect: 'error' });
    } catch { throw Object.assign(new Error('Formspree unavailable'), { status: 502, code: 'provider_unavailable' }); }
    if (!response.ok) {
      const status = response.status === 429 ? 429 : 502;
      const retry = Number(response.headers.get('retry-after'));
      throw Object.assign(new Error('Formspree request failed'), { status,
        code: status === 429 ? 'provider_rate_limited' : [401, 403].includes(response.status) ? 'provider_access_denied' : 'provider_unavailable',
        retryAfter: Number.isFinite(retry) && retry > 0 ? Math.min(Math.ceil(retry), 86400) : 60 });
    }
    let payload;
    try {
      // Bound upstream response memory; don't trust a compromised or malformed provider.
      const reader = response.body.getReader();
      let length = 0; const chunks = [];
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Oversized response'); }
        chunks.push(Buffer.from(value));
      }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { throw Object.assign(new Error('Invalid Formspree response'), { status: 502, code: 'provider_invalid_response' }); }
    if (!Array.isArray(payload.submissions) || payload.submissions.length > 100) throw Object.assign(new Error('Invalid Formspree response'), { status: 502, code: 'provider_invalid_response' });
    return payload.submissions;
  }
}
module.exports = { Formspree };
