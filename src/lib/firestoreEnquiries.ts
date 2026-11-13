import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from './workspaceAuth';
import { ClientEnquiry, QuotationRecord } from '../types/enquiry';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface StaffRoleRecord {
  email: string;
  role: 'admin' | 'coadmin';
  addedBy: string;
  createdAt?: string;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `enq_${Date.now()}`;
}

function formatDocTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val) {
    return val;
  }
  return new Date().toISOString();
}

export async function createPublicEnquiry(input: {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}): Promise<string> {
  const id = sanitizeId(`web_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `enquiries/${id}`;
  try {
    await setDoc(doc(db, 'enquiries', id), {
      id,
      name: input.name.trim().slice(0, 120),
      email: input.email.trim().slice(0, 160),
      phone: input.phone.trim().slice(0, 40),
      service: input.service.trim().slice(0, 80) || 'General Enquiry',
      message: input.message.trim().slice(0, 2000),
      source: 'Website',
      status: 'New',
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createStaffEnquiry(enquiry: ClientEnquiry): Promise<void> {
  const id = sanitizeId(enquiry.id);
  const path = `enquiries/${id}`;
  const payload: Record<string, unknown> = {
    id,
    name: (enquiry.name || 'Client').trim().slice(0, 120),
    email: (enquiry.email || '').trim().slice(0, 160),
    phone: (enquiry.phone || '').trim().slice(0, 40),
    service: (enquiry.service || 'General Enquiry').trim().slice(0, 80),
    message: (enquiry.message || 'Client enquiry').trim().slice(0, 2000),
    source: enquiry.source,
    status: enquiry.status,
    createdAt: serverTimestamp(),
  };

  if (enquiry.gmailMessageId) {
    payload.gmailMessageId = enquiry.gmailMessageId.slice(0, 128);
  }

  try {
    await setDoc(doc(db, 'enquiries', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateEnquiryQuotationInDb(
  enquiryId: string,
  quotation: QuotationRecord,
  newStatus?: ClientEnquiry['status']
): Promise<void> {
  const path = `enquiries/${enquiryId}`;
  const sanitizedQuotation: QuotationRecord = {
    quoteNumber: quotation.quoteNumber.slice(0, 60),
    quoteDate: quotation.quoteDate.slice(0, 30),
    validUntil: quotation.validUntil.slice(0, 30),
    serviceCategory: quotation.serviceCategory.slice(0, 80),
    items: quotation.items.slice(0, 50).map((it) => ({
      id: String(it.id).slice(0, 60),
      description: String(it.description || 'Work item').slice(0, 300),
      unit: String(it.unit || 'Job').slice(0, 30),
      quantity: Number(it.quantity) || 1,
      rate: Number(it.rate) || 0,
    })),
    gstPercent: Number(quotation.gstPercent) || 0,
    notes: String(quotation.notes || '').slice(0, 2000),
    subtotal: Number(quotation.subtotal) || 0,
    gstAmount: Number(quotation.gstAmount) || 0,
    totalAmount: Number(quotation.totalAmount) || 0,
    ...(quotation.sentVia ? { sentVia: quotation.sentVia } : {}),
    ...(quotation.sentAt ? { sentAt: quotation.sentAt.slice(0, 60) } : {}),
  };

  const updates: Record<string, unknown> = {
    quotation: sanitizedQuotation,
    updatedAt: serverTimestamp(),
  };
  if (newStatus) {
    updates.status = newStatus;
  }

  try {
    await updateDoc(doc(db, 'enquiries', enquiryId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteEnquiryInDb(enquiryId: string): Promise<void> {
  const path = `enquiries/${enquiryId}`;
  try {
    await deleteDoc(doc(db, 'enquiries', enquiryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeEnquiries(
  onData: (items: ClientEnquiry[]) => void,
  onError: (err: Error) => void
) {
  const path = 'enquiries';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ClientEnquiry[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: data.id || d.id,
          createdAt: formatDocTimestamp(data.createdAt),
          name: data.name || 'Client',
          email: data.email || '',
          phone: data.phone || '',
          service: data.service || 'General Enquiry',
          message: data.message || '',
          source: data.source || 'Website',
          status: data.status || 'New',
          gmailMessageId: data.gmailMessageId,
          quotation: data.quotation,
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function checkCoAdminRole(email: string): Promise<StaffRoleRecord | null> {
  const lower = email.toLowerCase().trim();
  const path = `staffRoles/${lower}`;
  try {
    const snap = await getDoc(doc(db, 'staffRoles', lower));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      email: data.email,
      role: data.role,
      addedBy: data.addedBy,
      createdAt: formatDocTimestamp(data.createdAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeCoAdmins(
  onData: (roles: StaffRoleRecord[]) => void,
  onError: (err: Error) => void
) {
  const path = 'staffRoles';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const roles: StaffRoleRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          email: data.email || d.id,
          role: data.role || 'coadmin',
          addedBy: data.addedBy || '',
          createdAt: formatDocTimestamp(data.createdAt),
        };
      });
      onData(roles);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function addCoAdmin(email: string, addedBy: string): Promise<void> {
  const lower = email.toLowerCase().trim();
  const path = `staffRoles/${lower}`;
  try {
    await setDoc(doc(db, 'staffRoles', lower), {
      email: lower,
      role: 'coadmin',
      addedBy: addedBy.toLowerCase().trim().slice(0, 160),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeCoAdmin(email: string): Promise<void> {
  const lower = email.toLowerCase().trim();
  const path = `staffRoles/${lower}`;
  try {
    await deleteDoc(doc(db, 'staffRoles', lower));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getSharedSheetsConfig(): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
} | null> {
  const path = 'appConfig/sheets';
  try {
    const snap = await getDoc(doc(db, 'appConfig', 'sheets'));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      spreadsheetId: data.spreadsheetId || '',
      spreadsheetUrl: data.spreadsheetUrl || '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSharedSheetsConfig(
  spreadsheetId: string,
  spreadsheetUrl: string,
  updatedBy: string
): Promise<void> {
  const path = 'appConfig/sheets';
  try {
    await setDoc(doc(db, 'appConfig', 'sheets'), {
      spreadsheetId: spreadsheetId.slice(0, 200),
      spreadsheetUrl: spreadsheetUrl.slice(0, 400),
      updatedBy: updatedBy.slice(0, 160),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
