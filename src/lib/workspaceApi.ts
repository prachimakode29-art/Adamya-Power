import * as XLSX from 'xlsx';
import { ClientEnquiry, QuotationRecord } from '../types/enquiry';

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  try {
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractBodyFromPayload(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      const nested = extractBodyFromPayload(part);
      if (nested) return nested;
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function parseFromHeader(fromHeader: string): { name: string; email: string } {
  const match = fromHeader.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^"|"$/g, '').trim() || match[2].split('@')[0],
      email: match[2].trim(),
    };
  }
  const email = fromHeader.trim();
  return {
    name: email.split('@')[0] || 'Client',
    email,
  };
}

function extractPhoneFromText(text: string): string {
  const match = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\+?\d[\d\s-]{8,14}\d/);
  return match ? match[0].replace(/\s+/g, '') : '';
}

function inferServiceFromText(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('civil') || lower.includes('shed') || lower.includes('foundation') || lower.includes('rcc')) {
    return 'Civil Engineering';
  }
  if (lower.includes('electrical') || lower.includes('ht/lt') || lower.includes('panel') || lower.includes('wiring') || lower.includes('substation')) {
    return 'Electrical Solutions';
  }
  if (lower.includes('mechanical') || lower.includes('piping') || lower.includes('hvac') || lower.includes('fabrication') || lower.includes('erection')) {
    return 'Mechanical Works';
  }
  if (lower.includes('maintenance') || lower.includes('overhaul')) {
    return 'Plant Maintenance';
  }
  if (lower.includes('power') || lower.includes('solar') || lower.includes('generator')) {
    return 'Power Systems';
  }
  if (lower.includes('turnkey')) {
    return 'Turnkey Projects';
  }
  return 'General Enquiry';
}

export async function fetchEnquiriesFromGmail(
  accessToken: string,
  searchQuery = 'in:inbox (quote OR quotation OR enquiry OR inquiry OR civil OR electrical OR mechanical OR project)'
): Promise<ClientEnquiry[]> {
  const queryParam = searchQuery.trim() ? `&q=${encodeURIComponent(searchQuery.trim())}` : '';
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12${queryParam}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail API error (${listRes.status}): ${errText}`);
  }

  const listData = await listRes.json();
  const messageRefs: Array<{ id: string }> = listData.messages || [];

  if (messageRefs.length === 0) {
    return [];
  }

  const messages = await Promise.all(
    messageRefs.slice(0, 10).map(async (ref) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (!msgRes.ok) return null;
      return msgRes.json();
    })
  );

  const enquiries: ClientEnquiry[] = [];
  for (const msg of messages) {
    if (!msg) continue;
    const headers: Array<{ name: string; value: string }> = msg.payload?.headers || [];
    const getHeader = (key: string) =>
      headers.find((h) => h.name.toLowerCase() === key.toLowerCase())?.value || '';

    const fromRaw = getHeader('From');
    const subject = getHeader('Subject') || 'Client Enquiry';
    const dateRaw = getHeader('Date');
    const { name, email } = parseFromHeader(fromRaw);
    const bodyText = extractBodyFromPayload(msg.payload) || msg.snippet || '';
    const combinedText = `${subject} ${bodyText}`;
    const phone = extractPhoneFromText(combinedText);

    enquiries.push({
      id: `gmail-${msg.id}`,
      gmailMessageId: msg.id,
      createdAt: dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString(),
      name,
      email,
      phone: phone || 'Not provided',
      service: inferServiceFromText(combinedText),
      message: `${subject}${bodyText ? ` — ${bodyText.slice(0, 260)}` : ''}`.trim(),
      source: 'Gmail',
      status: 'New',
    });
  }

  return enquiries;
}

export async function sendQuotationEmailViaGmail(
  accessToken: string,
  params: {
    toEmail: string;
    subject: string;
    textBody: string;
    htmlBody: string;
  }
): Promise<{ id: string }> {
  const boundary = `adamya_boundary_${Date.now()}`;
  const rawEmail = [
    `To: ${params.toEmail}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodeBase64Url(rawEmail),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to send Gmail quotation (${res.status}): ${errText}`);
  }

  return res.json();
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

export async function fetchSheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<{ title: string; firstSheetTitle: string }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=properties.title,sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Unable to read spreadsheet metadata (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const firstSheetTitle = data.sheets?.[0]?.properties?.title;
  if (!firstSheetTitle) {
    throw new Error('Spreadsheet has no worksheet tabs.');
  }
  return {
    title: data.properties?.title || 'Google Sheet',
    firstSheetTitle,
  };
}

export async function createLeadsSpreadsheet(
  accessToken: string,
  title = 'Adamya Power - Client Enquiries & Quotations'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; sheetTitle: string }> {
  const sheetTitle = 'Enquiries';
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: sheetTitle } }],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Sheet (${createRes.status}): ${errText}`);
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId as string;
  const spreadsheetUrl = created.spreadsheetUrl as string;

  const headers = [
    'Enquiry ID',
    'Date',
    'Client Name',
    'Email',
    'Phone',
    'Service Required',
    'Requirement / Message',
    'Source',
    'Status',
    'Quotation No.',
    'Quoted Total (INR)',
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(sheetTitle)}!A1:K1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetTitle}!A1:K1`,
        majorDimension: 'ROWS',
        values: [headers],
      }),
    }
  );

  return { spreadsheetId, spreadsheetUrl, sheetTitle };
}

export async function fetchEnquiriesFromSheet(
  accessToken: string,
  rawSpreadsheetInput: string
): Promise<{ title: string; sheetTitle: string; enquiries: ClientEnquiry[] }> {
  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetInput);
  const meta = await fetchSheetMetadata(accessToken, spreadsheetId);
  const range = `${meta.firstSheetTitle}!A1:K500`;

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch rows (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length <= 1) {
    return { title: meta.title, sheetTitle: meta.firstSheetTitle, enquiries: [] };
  }

  const headerRow = rows[0].map((h) => String(h).toLowerCase().trim());
  const findCol = (candidates: string[], fallbackIdx: number) => {
    const idx = headerRow.findIndex((h) => candidates.some((c) => h.includes(c)));
    return idx >= 0 ? idx : fallbackIdx;
  };

  const idIdx = findCol(['enquiry id', 'id'], 0);
  const dateIdx = findCol(['date', 'time'], 1);
  const nameIdx = findCol(['name', 'client'], 2);
  const emailIdx = findCol(['email', 'mail'], 3);
  const phoneIdx = findCol(['phone', 'mobile', 'whatsapp', 'contact'], 4);
  const serviceIdx = findCol(['service', 'category'], 5);
  const msgIdx = findCol(['message', 'requirement', 'details'], 6);
  const sourceIdx = findCol(['source'], 7);
  const statusIdx = findCol(['status'], 8);

  const enquiries: ClientEnquiry[] = rows
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row, idx) => ({
      id: row[idIdx]?.trim() || `sheet-${idx + 1}-${Date.now()}`,
      createdAt: row[dateIdx]?.trim() || new Date().toISOString(),
      name: row[nameIdx]?.trim() || 'Client',
      email: row[emailIdx]?.trim() || '',
      phone: row[phoneIdx]?.trim() || '',
      service: row[serviceIdx]?.trim() || 'General Enquiry',
      message: row[msgIdx]?.trim() || '',
      source: (row[sourceIdx]?.trim() as any) || 'Google Sheet',
      status: (row[statusIdx]?.trim() as any) || 'New',
    }));

  return { title: meta.title, sheetTitle: meta.firstSheetTitle, enquiries };
}

export async function syncEnquiriesToSheet(
  accessToken: string,
  rawSpreadsheetInput: string,
  enquiries: ClientEnquiry[]
): Promise<{ addedCount: number; sheetTitle: string; title: string }> {
  const spreadsheetId = extractSpreadsheetId(rawSpreadsheetInput);
  const meta = await fetchSheetMetadata(accessToken, spreadsheetId);
  const existingRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${meta.firstSheetTitle}!A1:K500`)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  const existingData = existingRes.ok ? await existingRes.json() : { values: [] };
  const existingRows: string[][] = existingData.values || [];

  const existingKeys = new Set(
    existingRows.slice(1).map((r) => `${r[0] || ''}|${r[3] || ''}|${r[4] || ''}`.toLowerCase())
  );

  const rowsToAppend: string[][] = [];
  if (existingRows.length === 0) {
    rowsToAppend.push([
      'Enquiry ID',
      'Date',
      'Client Name',
      'Email',
      'Phone',
      'Service Required',
      'Requirement / Message',
      'Source',
      'Status',
      'Quotation No.',
      'Quoted Total (INR)',
    ]);
  }

  let addedCount = 0;
  for (const enq of enquiries) {
    const key = `${enq.id}|${enq.email}|${enq.phone}`.toLowerCase();
    if (existingKeys.has(key)) continue;
    addedCount++;
    rowsToAppend.push([
      enq.id,
      new Date(enq.createdAt).toLocaleString('en-IN'),
      enq.name,
      enq.email,
      enq.phone,
      enq.service,
      enq.message,
      enq.source,
      enq.status,
      enq.quotation?.quoteNumber || '',
      enq.quotation ? String(enq.quotation.totalAmount) : '',
    ]);
  }

  if (rowsToAppend.length > 0) {
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values/${encodeURIComponent(`${meta.firstSheetTitle}!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: rowsToAppend,
        }),
      }
    );

    if (!appendRes.ok) {
      const errText = await appendRes.text();
      throw new Error(`Failed to append rows to Google Sheet (${appendRes.status}): ${errText}`);
    }
  }

  return { addedCount, sheetTitle: meta.firstSheetTitle, title: meta.title };
}

export function exportEnquiriesToExcel(enquiries: ClientEnquiry[]) {
  const rows = enquiries.map((item, index) => ({
    'Sr. No.': index + 1,
    'Enquiry ID': item.id,
    'Date & Time': new Date(item.createdAt).toLocaleString('en-IN'),
    'Client Name': item.name,
    'Email Address': item.email,
    'Phone / WhatsApp': item.phone,
    'Service Required': item.service,
    'Project Requirements': item.message,
    Source: item.source,
    Status: item.status,
    'Quotation No.': item.quotation?.quoteNumber || '-',
    'Quoted Amount (INR)': item.quotation ? item.quotation.totalAmount : 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 20 },
    { wch: 42 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Client Enquiries');
  XLSX.writeFile(workbook, `Adamya_Client_Enquiries_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function importEnquiriesFromExcel(file: File): Promise<ClientEnquiry[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('No worksheet found in the uploaded Excel file.');
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const pick = (row: Record<string, unknown>, keys: string[]): string => {
    for (const [k, v] of Object.entries(row)) {
      const normalized = k.toLowerCase().trim();
      if (keys.some((target) => normalized.includes(target)) && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
    return '';
  };

  return rawRows
    .map((row, index): ClientEnquiry | null => {
      const name = pick(row, ['name', 'client']);
      const email = pick(row, ['email', 'mail']);
      const phone = pick(row, ['phone', 'mobile', 'whatsapp', 'contact']);
      const service = pick(row, ['service', 'category', 'work']);
      const message = pick(row, ['message', 'requirement', 'description', 'remark', 'note']);

      if (!name && !email && !phone && !message) return null;

      return {
        id: `excel-${Date.now()}-${index}`,
        createdAt: new Date().toISOString(),
        name: name || 'Imported Client',
        email,
        phone,
        service: service || inferServiceFromText(message),
        message: message || 'Imported from Excel sheet',
        source: 'Excel',
        status: 'New',
      };
    })
    .filter((item): item is ClientEnquiry => item !== null);
}

export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppQuotationUrl(
  enquiry: ClientEnquiry,
  quotation: QuotationRecord
): string {
  const phone = normalizeWhatsAppPhone(enquiry.phone) || '919183877729';
  const lines = quotation.items
    .map(
      (item, idx) =>
        `${idx + 1}. ${item.description} (${item.quantity} ${item.unit} x ₹${item.rate.toLocaleString(
          'en-IN'
        )}) = ₹${(item.quantity * item.rate).toLocaleString('en-IN')}`
    )
    .join('\n');

  const text = [
    `Hello ${enquiry.name},`,
    `Thank you for contacting *Adamya Power & Industrial Solutions*.`,
    ``,
    `*QUOTATION: ${quotation.quoteNumber}*`,
    `Date: ${quotation.quoteDate} | Valid Until: ${quotation.validUntil}`,
    `Service: ${quotation.serviceCategory}`,
    ``,
    `*Scope & Pricing:*`,
    lines,
    ``,
    `Subtotal: ₹${quotation.subtotal.toLocaleString('en-IN')}`,
    `GST (${quotation.gstPercent}%): ₹${quotation.gstAmount.toLocaleString('en-IN')}`,
    `*Grand Total: ₹${quotation.totalAmount.toLocaleString('en-IN')}*`,
    quotation.notes ? `\nNotes: ${quotation.notes}` : '',
    ``,
    `Please reply to confirm or call us at +91 91838 77729.`,
    `Email: adamyapower@gmail.com`,
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppQuickReplyUrl(enquiry: ClientEnquiry): string {
  const phone = normalizeWhatsAppPhone(enquiry.phone);
  if (!phone) return 'https://wa.me/919183877729';
  const text = `Hello ${enquiry.name}, thank you for reaching out to Adamya Power & Industrial Solutions regarding ${enquiry.service}. Our engineering team has received your request and would like to share the project details and quotation with you.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
