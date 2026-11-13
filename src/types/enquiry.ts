export type EnquirySource = 'Website' | 'Gmail' | 'WhatsApp' | 'Excel' | 'Google Sheet';

export type EnquiryStatus = 'New' | 'Quoted (Gmail)' | 'Quoted (WhatsApp)' | 'Follow-up' | 'Approved';

export interface QuotationItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
}

export interface QuotationRecord {
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  serviceCategory: string;
  items: QuotationItem[];
  gstPercent: number;
  notes: string;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  sentVia?: 'Gmail' | 'WhatsApp' | 'Draft';
  sentAt?: string;
}

export interface ClientEnquiry {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  source: EnquirySource;
  status: EnquiryStatus;
  gmailMessageId?: string;
  quotation?: QuotationRecord;
}
