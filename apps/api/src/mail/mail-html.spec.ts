import { escapeMailHtml } from './mail-html.js';

describe('escapeMailHtml', () => {
  it('escapes every dynamic HTML metacharacter', () => {
    expect(escapeMailHtml(`<script title="x">Tom & 'Ana'</script>`)).toBe(
      '&lt;script title=&quot;x&quot;&gt;Tom &amp; &#39;Ana&#39;&lt;/script&gt;',
    );
  });
});
