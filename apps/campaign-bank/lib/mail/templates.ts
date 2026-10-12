// Plain, brand light email. Same type and colors as the app. One short sentence at a time.
export interface MailItem {
  name: string;
  sub: string;
  thumbUrl?: string | null;
  line?: string | null;
}

export interface MailContent {
  heading: string;
  intro: string;
  items: MailItem[];
  cta: { label: string; url: string };
  footer?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMail(c: MailContent): { html: string; text: string } {
  const items = c.items
    .map(
      (it) => `
      <tr><td style="padding:0 0 14px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e6e3dc;border-radius:12px;background:#ffffff">
          <tr>
            ${it.thumbUrl ? `<td style="width:72px;padding:12px 0 12px 12px;vertical-align:top"><img src="${esc(it.thumbUrl)}" width="60" alt="" style="display:block;width:60px;border-radius:6px;border:1px solid #e6e3dc"></td>` : ''}
            <td style="padding:12px 14px;vertical-align:top;font-family:Helvetica,Arial,sans-serif">
              <div style="font-family:Newsreader,Georgia,serif;font-size:17px;color:#1b1a17;line-height:1.25">${esc(it.name)}</div>
              ${it.sub ? `<div style="font-size:13px;color:#6b6861;margin-top:3px">${esc(it.sub)}</div>` : ''}
              ${it.line ? `<div style="font-size:13px;color:#1b1a17;margin-top:8px;background:#f2f0fb;border-radius:8px;padding:8px 10px">${esc(it.line)}</div>` : ''}
            </td>
          </tr>
        </table>
      </td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f8f7f4;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;color:#1b1a17">
<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;width:100%">
  <tr><td style="padding:0 0 18px 0">
    <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#4b3fd6;font-weight:700">Campaign Bank</div>
    <h1 style="font-family:Newsreader,Georgia,serif;font-weight:500;font-size:26px;line-height:1.15;margin:8px 0 0">${esc(c.heading)}</h1>
    <p style="font-size:14px;line-height:1.5;color:#6b6861;margin:10px 0 0">${esc(c.intro)}</p>
  </td></tr>
  ${items}
  <tr><td style="padding:6px 0 22px 0">
    <a href="${esc(c.cta.url)}" style="display:inline-block;background:#4b3fd6;color:#ffffff;text-decoration:none;font-size:14px;padding:11px 16px;border-radius:10px">${esc(c.cta.label)}</a>
  </td></tr>
  <tr><td style="font-size:12px;color:#9b978e;line-height:1.5">${esc(c.footer ?? 'You are getting this because you review campaigns in the Campaign Bank.')}</td></tr>
</table>
</body></html>`;

  const text = [
    c.heading,
    '',
    c.intro,
    '',
    ...c.items.flatMap((it) => [`${it.name}${it.sub ? `, ${it.sub}` : ''}`, ...(it.line ? [`  ${it.line}`] : []), '']),
    `${c.cta.label}: ${c.cta.url}`,
    '',
    c.footer ?? 'You are getting this because you review campaigns in the Campaign Bank.',
  ].join('\n');

  return { html, text };
}
