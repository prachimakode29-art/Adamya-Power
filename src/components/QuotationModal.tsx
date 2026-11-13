import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Mail,
  MessageSquare,
  Printer,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { ClientEnquiry, QuotationItem, QuotationRecord } from '../types/enquiry';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { buildWhatsAppQuotationUrl, sendQuotationEmailViaGmail } from '../lib/workspaceApi';
import { getAccessToken } from '../lib/workspaceAuth';

interface QuotationModalProps {
  enquiry: ClientEnquiry | null;
  isGoogleSignedIn: boolean;
  onRequestGoogleSignIn: () => Promise<void>;
  onClose: () => void;
  onSaveQuotation: (
    enquiryId: string,
    quotation: QuotationRecord,
    newStatus?: ClientEnquiry['status']
  ) => Promise<void> | void;
}

const SERVICE_TEMPLATES: Record<string, Array<Omit<QuotationItem, 'id'>>> = {
  'Civil Engineering': [
    { description: 'Site Excavation, Grading & PCC Foundation Work', unit: 'Sq.ft', quantity: 500, rate: 145 },
    { description: 'RCC Machine Foundation & Structural Concrete (M25)', unit: 'Cu.m', quantity: 12, rate: 6800 },
    { description: 'Industrial Shed Fabrication & Roofing Erection', unit: 'Sq.ft', quantity: 1000, rate: 320 },
  ],
  'Electrical Solutions': [
    { description: 'HT/LT Panel Supply, Installation & Termination', unit: 'Set', quantity: 1, rate: 85000 },
    { description: 'Armoured Power Cable Laying & Earthing Pit Setup', unit: 'Mtr', quantity: 150, rate: 480 },
    { description: 'Testing, Meggering & Safety Commissioning', unit: 'Job', quantity: 1, rate: 15000 },
  ],
  'Mechanical Works': [
    { description: 'Heavy Machinery Alignment, Grouting & Erection', unit: 'Job', quantity: 1, rate: 65000 },
    { description: 'MS/SS Industrial Piping & Valve Assembly', unit: 'Mtr', quantity: 80, rate: 950 },
    { description: 'Pressure Testing & Quality Inspection', unit: 'Job', quantity: 1, rate: 12000 },
  ],
};

function defaultItemsForService(service: string): QuotationItem[] {
  const matched =
    SERVICE_TEMPLATES[service] || [
      {
        description: `${service || 'Engineering'} Scope Assessment, Execution & Commissioning`,
        unit: 'Job',
        quantity: 1,
        rate: 45000,
      },
    ];
  return matched.map((item, idx) => ({
    ...item,
    id: `item-${Date.now()}-${idx}`,
  }));
}

export function QuotationModal({
  enquiry,
  isGoogleSignedIn,
  onRequestGoogleSignIn,
  onClose,
  onSaveQuotation,
}: QuotationModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const validDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [quoteNumber, setQuoteNumber] = useState(
    enquiry?.quotation?.quoteNumber || `QTN-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 900))}`
  );
  const [quoteDate, setQuoteDate] = useState(enquiry?.quotation?.quoteDate || today);
  const [validUntil, setValidUntil] = useState(enquiry?.quotation?.validUntil || validDate);
  const [serviceCategory, setServiceCategory] = useState(
    enquiry?.quotation?.serviceCategory || enquiry?.service || 'Civil Engineering'
  );
  const [items, setItems] = useState<QuotationItem[]>(
    enquiry?.quotation?.items || defaultItemsForService(enquiry?.service || 'Civil Engineering')
  );
  const [gstPercent, setGstPercent] = useState<number>(enquiry?.quotation?.gstPercent ?? 18);
  const [notes, setNotes] = useState(
    enquiry?.quotation?.notes ||
      '1. Payment Terms: 50% advance, 40% on material delivery/progress, 10% on completion.\n2. Work adheres to IS industrial safety standards.'
  );
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showGmailConfirm, setShowGmailConfirm] = useState(false);
  const [isSendingGmail, setIsSendingGmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.rate || 0), 0);
    const gstAmount = Math.round((subtotal * Number(gstPercent || 0)) / 100);
    const totalAmount = subtotal + gstAmount;
    return { subtotal, gstAmount, totalAmount };
  }, [items, gstPercent]);

  if (!enquiry) return null;

  const currentQuotation: QuotationRecord = {
    quoteNumber,
    quoteDate,
    validUntil,
    serviceCategory,
    items,
    gstPercent,
    notes,
    subtotal: totals.subtotal,
    gstAmount: totals.gstAmount,
    totalAmount: totals.totalAmount,
    sentVia: enquiry.quotation?.sentVia || 'Draft',
    sentAt: enquiry.quotation?.sentAt,
  };

  const whatsappUrl = buildWhatsAppQuotationUrl(enquiry, currentQuotation);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `item-${Date.now()}`, description: '', unit: 'Job', quantity: 1, rate: 0 },
    ]);
  };

  const handleUpdateItem = (id: string, field: keyof QuotationItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleApplyTemplate = (category: string) => {
    setServiceCategory(category);
    setItems(defaultItemsForService(category));
  };

  const buildEmailContent = () => {
    const subject = `Quotation ${quoteNumber} — ${serviceCategory} | Adamya Power & Industrial Solutions`;
    const itemLinesText = items
      .map(
        (it, i) =>
          `${i + 1}. ${it.description} | ${it.quantity} ${it.unit} x ₹${it.rate.toLocaleString(
            'en-IN'
          )} = ₹${(it.quantity * it.rate).toLocaleString('en-IN')}`
      )
      .join('\n');

    const textBody = [
      `Dear ${enquiry.name},`,
      '',
      `Thank you for contacting Adamya Power & Industrial Solutions. Please find below our quotation for your ${serviceCategory} requirements.`,
      '',
      `Quotation No: ${quoteNumber}`,
      `Date: ${quoteDate} | Valid Until: ${validUntil}`,
      '',
      'Scope & Pricing:',
      itemLinesText,
      '',
      `Subtotal: ₹${totals.subtotal.toLocaleString('en-IN')}`,
      `GST (${gstPercent}%): ₹${totals.gstAmount.toLocaleString('en-IN')}`,
      `Grand Total: ₹${totals.totalAmount.toLocaleString('en-IN')}`,
      '',
      notes ? `Terms & Notes:\n${notes}` : '',
      '',
      'For any clarifications, feel free to reply to this email or call/WhatsApp us on +91 91838 77729.',
      '',
      'Warm regards,',
      'Adamya Power & Industrial Solutions',
      'Phone / WhatsApp: +91 91838 77729',
      'Email: adamyapower@gmail.com',
    ]
      .filter(Boolean)
      .join('\n');

    const rowsHtml = items
      .map(
        (it, i) => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${i + 1}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${it.description}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity} ${it.unit}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;">₹${it.rate.toLocaleString('en-IN')}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">₹${(
              it.quantity * it.rate
            ).toLocaleString('en-IN')}</td>
          </tr>`
      )
      .join('');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;color:#1e293b;max-width:680px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0c2340,#0055cc);color:#ffffff;padding:24px;">
          <h2 style="margin:0;font-size:20px;">ADAMYA Power &amp; Industrial Solutions</h2>
          <p style="margin:6px 0 0;font-size:13px;color:#dbeafe;">Official Project Quotation • ${quoteNumber}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin-top:0;">Dear <strong>${enquiry.name}</strong>,</p>
          <p>Thank you for your enquiry. Please find our quotation details below for <strong>${serviceCategory}</strong>:</p>
          <p style="font-size:13px;color:#475569;">Date: <strong>${quoteDate}</strong> &nbsp;|&nbsp; Valid Until: <strong>${validUntil}</strong></p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
            <thead>
              <tr style="background:#f8fafc;color:#0c2340;text-align:left;">
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">#</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;">Description</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;text-align:center;">Qty</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;text-align:right;">Rate</th>
                <th style="padding:10px;border-bottom:2px solid #cbd5e1;text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="text-align:right;margin-top:12px;font-size:14px;">
            <div>Subtotal: <strong>₹${totals.subtotal.toLocaleString('en-IN')}</strong></div>
            <div>GST (${gstPercent}%): <strong>₹${totals.gstAmount.toLocaleString('en-IN')}</strong></div>
            <div style="font-size:18px;color:#003399;margin-top:6px;">Grand Total: <strong>₹${totals.totalAmount.toLocaleString('en-IN')}</strong></div>
          </div>
          ${
            notes
              ? `<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:8px;font-size:12px;color:#475569;white-space:pre-line;"><strong>Notes &amp; Terms:</strong>\n${notes}</div>`
              : ''
          }
          <p style="margin-top:20px;font-size:13px;color:#475569;">
            Warm regards,<br/>
            <strong>Adamya Power &amp; Industrial Solutions</strong><br/>
            Phone / WhatsApp: +91 91838 77729 | Email: adamyapower@gmail.com
          </p>
        </div>
      </div>
    `;

    return { subject, textBody, htmlBody };
  };

  const handleConfirmGmailSend = async () => {
    if (!enquiry.email) {
      setFeedback({ type: 'error', text: 'Client email address is missing.' });
      setShowGmailConfirm(false);
      return;
    }

    setIsSendingGmail(true);
    setFeedback(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        await onRequestGoogleSignIn();
        token = await getAccessToken();
      }
      if (!token) {
        throw new Error('Please sign in with Google to send quotation via Gmail.');
      }

      const { subject, textBody, htmlBody } = buildEmailContent();
      await sendQuotationEmailViaGmail(token, {
        toEmail: enquiry.email,
        subject,
        textBody,
        htmlBody,
      });

      const saved: QuotationRecord = {
        ...currentQuotation,
        sentVia: 'Gmail',
        sentAt: new Date().toISOString(),
      };
      await onSaveQuotation(enquiry.id, saved, 'Quoted (Gmail)');
      setShowGmailConfirm(false);
      setFeedback({ type: 'success', text: `Quotation ${quoteNumber} sent via Gmail to ${enquiry.email}!` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to send Gmail quotation.' });
      setShowGmailConfirm(false);
    } finally {
      setIsSendingGmail(false);
    }
  };

  const handleInitiateGmailSend = async () => {
    setFeedback(null);
    if (!enquiry.email || !enquiry.email.includes('@')) {
      setFeedback({ type: 'error', text: 'This client record does not have a valid email address.' });
      return;
    }
    if (!isGoogleSignedIn) {
      try {
        await onRequestGoogleSignIn();
      } catch (err: any) {
        setFeedback({ type: 'error', text: err?.message || 'Google sign-in is required to send via Gmail.' });
        return;
      }
    }
    setShowGmailConfirm(true);
  };

  const handleSaveDraft = async () => {
    try {
      await onSaveQuotation(enquiry.id, { ...currentQuotation, sentVia: 'Draft' });
      setFeedback({ type: 'success', text: 'Quotation saved to client record.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to save draft.' });
    }
  };

  const handleMarkWhatsAppSent = async () => {
    try {
      await onSaveQuotation(
        enquiry.id,
        { ...currentQuotation, sentVia: 'WhatsApp', sentAt: new Date().toISOString() },
        'Quoted (WhatsApp)'
      );
      setFeedback({ type: 'success', text: 'Quotation opened in WhatsApp & status updated.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to update quotation status.' });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50 no-print">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#0c2340] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0055cc]" />
                Client Quotation Builder
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                For <span className="font-semibold text-slate-700">{enquiry.name}</span> ({enquiry.phone || enquiry.email})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPrintPreview(!showPrintPreview)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[#0c2340] hover:border-[#0055cc]"
              >
                {showPrintPreview ? 'Edit Line Items' : 'Print / PDF View'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                aria-label="Close quotation modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 no-print ${
                  feedback.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{feedback.text}</span>
              </div>
            )}

            {showPrintPreview ? (
              <div id="printable-quotation" className="border border-gray-200 rounded-xl p-6 sm:p-8 bg-white space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                  <div className="flex items-center gap-3">
                    <img src="/logo.jpg" alt="Adamya Power Logo" className="w-16 h-16 rounded-xl object-contain border border-gray-100" />
                    <div>
                      <h2 className="text-xl font-extrabold text-[#0c2340]">ADAMYA</h2>
                      <p className="text-xs font-bold tracking-wider text-[#0055cc] uppercase">Power &amp; Industrial Solutions</p>
                      <p className="text-xs text-gray-500 mt-1">+91 91838 77729 • adamyapower@gmail.com</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs uppercase tracking-wider text-gray-400 font-bold">Quotation</div>
                    <div className="text-lg font-extrabold text-[#0c2340]">{quoteNumber}</div>
                    <div className="text-xs text-gray-600">Date: {quoteDate}</div>
                    <div className="text-xs text-gray-600">Valid Until: {validUntil}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-400 mb-1">Prepared For</div>
                    <div className="font-bold text-[#0c2340]">{enquiry.name}</div>
                    {enquiry.email && <div className="text-gray-600">{enquiry.email}</div>}
                    {enquiry.phone && <div className="text-gray-600">{enquiry.phone}</div>}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-400 mb-1">Project Scope</div>
                    <div className="font-semibold text-[#0055cc]">{serviceCategory}</div>
                    <div className="text-gray-600 text-xs mt-1">{enquiry.message}</div>
                  </div>
                </div>

                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#0c2340] text-white">
                      <th className="py-2.5 px-3 text-left rounded-tl-lg">#</th>
                      <th className="py-2.5 px-3 text-left">Work Description</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right rounded-tr-lg">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-600">
                          ₹{Number(item.rate).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[#0c2340]">
                          ₹{(Number(item.quantity) * Number(item.rate)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-full sm:w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>₹{totals.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>GST ({gstPercent}%)</span>
                      <span>₹{totals.gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-[#0c2340] border-t border-gray-200 pt-2">
                      <span>Grand Total</span>
                      <span>₹{totals.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {notes && (
                  <div className="bg-slate-50 rounded-xl p-4 text-xs text-gray-600 whitespace-pre-line border border-gray-100">
                    <span className="font-bold text-[#0c2340] block mb-1">Terms &amp; Conditions:</span>
                    {notes}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {/* Client Request Box */}
                <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-sm">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#0055cc] mb-1">
                    Client Requirement ({enquiry.source})
                  </div>
                  <p className="text-slate-700">{enquiry.message}</p>
                </div>

                {/* Metadata Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quotation No.</label>
                    <input
                      type="text"
                      value={quoteNumber}
                      onChange={(e) => setQuoteNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#0055cc] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quote Date</label>
                    <input
                      type="date"
                      value={quoteDate}
                      onChange={(e) => setQuoteDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#0055cc] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Valid Until</label>
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-[#0055cc] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Service Template</label>
                    <select
                      value={serviceCategory}
                      onChange={(e) => handleApplyTemplate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-[#0055cc] outline-none"
                    >
                      <option value="Civil Engineering">Civil Engineering</option>
                      <option value="Electrical Solutions">Electrical Solutions</option>
                      <option value="Mechanical Works">Mechanical Works</option>
                      <option value="Plant Maintenance">Plant Maintenance</option>
                      <option value="Power Systems">Power Systems</option>
                      <option value="Turnkey Projects">Turnkey Projects</option>
                    </select>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#0c2340]">Work Items &amp; Pricing</h4>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0055cc] hover:underline"
                    >
                      <Plus size={14} /> Add Line Item
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-gray-100"
                      >
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            placeholder="Work item description"
                            value={item.description}
                            onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="text"
                            placeholder="Unit"
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="number"
                            min={1}
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number"
                            min={0}
                            placeholder="Rate ₹"
                            value={item.rate}
                            onChange={(e) => handleUpdateItem(item.id, 'rate', Number(e.target.value))}
                            className="w-full px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length <= 1}
                            className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-30"
                            aria-label="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals + Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Terms &amp; Notes</label>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc] resize-none"
                    />
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-gray-200 space-y-2.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">₹{totals.subtotal.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center justify-between text-gray-600">
                      <span>GST (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={28}
                        value={gstPercent}
                        onChange={(e) => setGstPercent(Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded border border-gray-200 bg-white text-right text-sm"
                      />
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>GST Amount</span>
                      <span className="font-semibold">₹{totals.gstAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-lg font-extrabold text-[#0c2340] border-t border-gray-200 pt-2">
                      <span>Grand Total</span>
                      <span>₹{totals.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={handleSaveDraft} className="py-2.5 px-4 text-sm">
                Save Draft
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowPrintPreview(true);
                  setTimeout(() => window.print(), 100);
                }}
                className="py-2.5 px-4 text-sm gap-1.5"
              >
                <Printer size={16} />
                Print / PDF
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleMarkWhatsAppSent}
                className="px-4 py-2.5 rounded-lg font-medium text-sm bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors inline-flex items-center gap-2 shadow-sm"
              >
                <MessageSquare size={16} />
                Send on WhatsApp
              </a>
              <Button
                type="button"
                variant="primary"
                onClick={handleInitiateGmailSend}
                className="py-2.5 px-5 text-sm gap-2"
              >
                <Mail size={16} />
                Send via Gmail
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showGmailConfirm}
        title="Send Quotation via Gmail?"
        description="Please confirm before sending this official quotation email on your behalf."
        details={[
          `To: ${enquiry.email}`,
          `Subject: Quotation ${quoteNumber} — ${serviceCategory}`,
          `Total Amount: ₹${totals.totalAmount.toLocaleString('en-IN')} (incl. ${gstPercent}% GST)`,
        ]}
        confirmLabel="Send Email Now"
        isLoading={isSendingGmail}
        onConfirm={handleConfirmGmailSend}
        onCancel={() => setShowGmailConfirm(false)}
      />
    </>
  );
}
