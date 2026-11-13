import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Mail,
  FileSpreadsheet,
  Download,
  Upload,
  MessageSquare,
  Plus,
  Search,
  RefreshCw,
  FileText,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Users,
  Trash2,
} from 'lucide-react';
import { ClientEnquiry, QuotationRecord } from '../types/enquiry';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ConfirmDialog';
import { QuotationModal } from './QuotationModal';
import {
  initAuth,
  googleSignIn,
  adminBasicSignIn,
  getAccessToken,
  logout,
  isSuperAdminEmail,
  getUserEmail,
  SUPER_ADMIN_EMAILS,
} from '../lib/workspaceAuth';
import {
  subscribeEnquiries,
  createStaffEnquiry,
  updateEnquiryQuotationInDb,
  checkCoAdminRole,
  subscribeCoAdmins,
  addCoAdmin,
  removeCoAdmin,
  getSharedSheetsConfig,
  saveSharedSheetsConfig,
  StaffRoleRecord,
} from '../lib/firestoreEnquiries';
import {
  fetchEnquiriesFromGmail,
  createLeadsSpreadsheet,
  fetchEnquiriesFromSheet,
  syncEnquiriesToSheet,
  exportEnquiriesToExcel,
  importEnquiriesFromExcel,
  buildWhatsAppQuickReplyUrl,
} from '../lib/workspaceApi';

interface LeadsWorkspaceProps {
  onBackToWebsite: () => void;
}

export function LeadsWorkspace({ onBackToWebsite }: LeadsWorkspaceProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [hasWorkspaceToken, setHasWorkspaceToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [roleStatus, setRoleStatus] = useState<'checking' | 'admin' | 'coadmin' | 'denied'>('checking');
  const [resolvedEmail, setResolvedEmail] = useState<string>('');
  const [enquiries, setEnquiries] = useState<ClientEnquiry[]>([]);
  const [coAdmins, setCoAdmins] = useState<StaffRoleRecord[]>([]);
  const [newCoAdminEmail, setNewCoAdminEmail] = useState('');
  const [showTeamPanel, setShowTeamPanel] = useState(false);

  const [isLoadingGmail, setIsLoadingGmail] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [connectedSheetUrl, setConnectedSheetUrl] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedEnquiry, setSelectedEnquiry] = useState<ClientEnquiry | null>(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [manualLead, setManualLead] = useState({
    name: '',
    email: '',
    phone: '',
    service: 'Civil Engineering',
    source: 'WhatsApp' as ClientEnquiry['source'],
    message: '',
  });

  const [confirmAction, setConfirmAction] = useState<
    null | { type: 'create_sheet' } | { type: 'sync_sheet' }
  >(null);

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track Firebase Auth user
  useEffect(() => {
    const unsub = initAuth((authedUser, token) => {
      setUser(authedUser);
      setHasWorkspaceToken(Boolean(token));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Verify Admin or Co-Admin role whenever user changes
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setResolvedEmail('');
      setRoleStatus('denied');
      setEnquiries([]);
      setCoAdmins([]);
      return;
    }

    let cancelled = false;
    setRoleStatus('checking');

    (async () => {
      try {
        const tokenResult = await user.getIdTokenResult();
        const claimEmail =
          typeof tokenResult.claims?.email === 'string'
            ? tokenResult.claims.email.toLowerCase().trim()
            : '';
        const email = claimEmail || getUserEmail(user);
        const isGoogleVerified =
          Boolean(tokenResult.claims?.email_verified) ||
          user.emailVerified ||
          user.providerData?.some((p) => p.providerId === 'google.com');

        if (!cancelled) setResolvedEmail(email);

        if (!email) {
          if (!cancelled) setRoleStatus('denied');
          return;
        }

        if (isGoogleVerified && isSuperAdminEmail(email)) {
          if (!cancelled) setRoleStatus('admin');
          return;
        }

        const roleDoc = await checkCoAdminRole(email);
        if (!cancelled) {
          setRoleStatus(roleDoc && isGoogleVerified ? 'coadmin' : 'denied');
        }
      } catch (err) {
        console.error('Role verification failed:', err);
        if (!cancelled) setRoleStatus('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  // Subscribe to Firestore enquiries & shared config ONLY for verified Admin / Co-Admin
  useEffect(() => {
    if (roleStatus !== 'admin' && roleStatus !== 'coadmin') return;

    const unsubEnquiries = subscribeEnquiries(
      (list) => setEnquiries(list),
      (err) => setNotice({ type: 'error', text: err.message || 'Unable to load enquiries.' })
    );

    getSharedSheetsConfig()
      .then((cfg) => {
        if (cfg) {
          setSpreadsheetInput(cfg.spreadsheetId);
          setConnectedSheetUrl(cfg.spreadsheetUrl);
        }
      })
      .catch(() => {
        // Optional shared sheet config
      });

    let unsubRoles = () => {};
    if (roleStatus === 'admin') {
      unsubRoles = subscribeCoAdmins(
        (list) => setCoAdmins(list),
        () => {}
      );
    }

    return () => {
      unsubEnquiries();
      unsubRoles();
    };
  }, [roleStatus]);

  const formatAuthError = (err: any): string => {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');

    if (msg.toLowerCase().includes('access_denied') || code.includes('access_denied')) {
      return `Google blocked sign-in (403 access_denied). The project owner must add your email under Google Cloud Console → APIs & Services → OAuth consent screen → Test users.`;
    }
    if (code === 'auth/popup-blocked') {
      return 'Sign-in popup was blocked by your browser. Please allow popups for this site or open the Admin Portal in a new tab.';
    }
    if (code === 'auth/unauthorized-domain') {
      return `This domain (${window.location.hostname}) is not authorized in Firebase Authentication (${code}).`;
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return `Sign-in popup closed before completing (${code}). If Google showed "403: access_denied / App not verified", add your email to Test Users in Google Cloud Console, or open the Admin Portal in a full browser tab.`;
    }
    return code ? `${msg} (${code})` : msg || 'Google sign-in was cancelled or failed.';
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setNotice(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasWorkspaceToken(Boolean(result.accessToken));
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: formatAuthError(err),
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBasicLogin = async () => {
    setIsLoggingIn(true);
    setNotice(null);
    try {
      const result = await adminBasicSignIn();
      if (result) {
        setUser(result.user);
        setHasWorkspaceToken(Boolean(result.accessToken));
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        text: formatAuthError(err),
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setHasWorkspaceToken(false);
    setEnquiries([]);
    setNotice(null);
  };

  const ensureWorkspaceToken = async (): Promise<string> => {
    let token = await getAccessToken();
    if (!token) {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setHasWorkspaceToken(true);
        token = res.accessToken;
      }
    }
    if (!token) {
      throw new Error('Please sign in with Google to grant Gmail & Sheets access.');
    }
    return token;
  };

  const persistUniqueEnquiries = async (incoming: ClientEnquiry[]): Promise<number> => {
    const existingKeys = new Set(
      enquiries.map((item) =>
        item.gmailMessageId
          ? `gmail:${item.gmailMessageId}`
          : `${item.name}|${item.email}|${item.phone}|${item.message}`.toLowerCase()
      )
    );

    const uniqueNew = incoming.filter((item) => {
      const key = item.gmailMessageId
        ? `gmail:${item.gmailMessageId}`
        : `${item.name}|${item.email}|${item.phone}|${item.message}`.toLowerCase();
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    for (const item of uniqueNew) {
      await createStaffEnquiry(item);
    }
    return uniqueNew.length;
  };

  const handleFetchGmail = async () => {
    setIsLoadingGmail(true);
    setNotice(null);
    try {
      const token = await ensureWorkspaceToken();
      const fetched = await fetchEnquiriesFromGmail(token);
      if (fetched.length === 0) {
        setNotice({
          type: 'success',
          text: 'No matching client inquiry emails found in your Gmail inbox.',
        });
      } else {
        const added = await persistUniqueEnquiries(fetched);
        setNotice({
          type: 'success',
          text: `Fetched ${fetched.length} emails from Gmail (${added} new client leads saved).`,
        });
      }
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Unable to fetch emails from Gmail.' });
    } finally {
      setIsLoadingGmail(false);
    }
  };

  const handleFetchFromSheet = async () => {
    if (!spreadsheetInput.trim()) {
      setNotice({
        type: 'error',
        text: 'Enter a Google Sheet URL or ID, or create a new sheet first.',
      });
      return;
    }
    setIsSyncingSheet(true);
    setNotice(null);
    try {
      const token = await ensureWorkspaceToken();
      const result = await fetchEnquiriesFromSheet(token, spreadsheetInput);
      const added = await persistUniqueEnquiries(result.enquiries);
      const actorEmail = resolvedEmail || getUserEmail(user);
      if (actorEmail) {
        await saveSharedSheetsConfig(spreadsheetInput.trim(), connectedSheetUrl, actorEmail);
      }
      setNotice({
        type: 'success',
        text: `Fetched ${result.enquiries.length} rows from "${result.title}" (${result.sheetTitle}). ${added} new leads added.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to read Google Sheet.' });
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleConfirmedSheetAction = async () => {
    if (!confirmAction) return;
    setIsSyncingSheet(true);
    setNotice(null);
    try {
      const token = await ensureWorkspaceToken();
      const actorEmail = resolvedEmail || getUserEmail(user);
      if (confirmAction.type === 'create_sheet') {
        const created = await createLeadsSpreadsheet(token);
        setSpreadsheetInput(created.spreadsheetId);
        setConnectedSheetUrl(created.spreadsheetUrl);
        if (actorEmail) {
          await saveSharedSheetsConfig(created.spreadsheetId, created.spreadsheetUrl, actorEmail);
        }
        if (enquiries.length > 0) {
          await syncEnquiriesToSheet(token, created.spreadsheetId, enquiries);
        }
        setNotice({
          type: 'success',
          text: `Created Google Sheet "Adamya Power - Client Enquiries & Quotations" and synced ${enquiries.length} rows.`,
        });
      } else if (confirmAction.type === 'sync_sheet') {
        const res = await syncEnquiriesToSheet(token, spreadsheetInput, enquiries);
        if (actorEmail) {
          await saveSharedSheetsConfig(spreadsheetInput.trim(), connectedSheetUrl, actorEmail);
        }
        setNotice({
          type: 'success',
          text: `Synced ${res.addedCount} new client records to "${res.title}" (${res.sheetTitle}).`,
        });
      }
      setConfirmAction(null);
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Google Sheets operation failed.' });
      setConfirmAction(null);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    try {
      const imported = await importEnquiriesFromExcel(file);
      const added = await persistUniqueEnquiries(imported);
      setNotice({
        type: 'success',
        text: `Imported ${imported.length} rows from "${file.name}" (${added} new leads saved).`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not parse the Excel file.' });
    } finally {
      e.target.value = '';
    }
  };

  const handleAddManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: ClientEnquiry = {
      id: `manual_${Date.now()}`,
      createdAt: new Date().toISOString(),
      name: manualLead.name.trim(),
      email: manualLead.email.trim(),
      phone: manualLead.phone.trim(),
      service: manualLead.service,
      message: manualLead.message.trim(),
      source: manualLead.source,
      status: 'New',
    };
    try {
      await createStaffEnquiry(newEntry);
      setManualLead({
        name: '',
        email: '',
        phone: '',
        service: 'Civil Engineering',
        source: 'WhatsApp',
        message: '',
      });
      setShowAddLead(false);
      setNotice({ type: 'success', text: `Added ${newEntry.name} to client enquiries.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not save lead.' });
    }
  };

  const handleAddCoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newCoAdminEmail.toLowerCase().trim();
    const actorEmail = resolvedEmail || getUserEmail(user);
    if (!email || !email.includes('@') || !actorEmail) return;
    setNotice(null);
    try {
      await addCoAdmin(email, actorEmail);
      setNewCoAdminEmail('');
      setNotice({ type: 'success', text: `Co-Admin access granted to ${email}.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to add Co-Admin.' });
    }
  };

  const handleRemoveCoAdmin = async (email: string) => {
    setNotice(null);
    try {
      await removeCoAdmin(email);
      setNotice({ type: 'success', text: `Removed Co-Admin access for ${email}.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to remove Co-Admin.' });
    }
  };

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.service.toLowerCase().includes(q) ||
        item.message.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [enquiries, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const quotedCount = enquiries.filter((e) => e.quotation || e.status.startsWith('Quoted')).length;
    const totalValue = enquiries.reduce((sum, e) => sum + (e.quotation?.totalAmount || 0), 0);
    return {
      total: enquiries.length,
      quoted: quotedCount,
      pending: enquiries.length - quotedCount,
      totalValue,
    };
  }, [enquiries]);

  // 1. Not signed in yet -> Admin / Co-Admin Login Gate
  if (!authReady || (user && roleStatus === 'checking')) {
    return (
      <section className="py-20 bg-slate-50 min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-[#0055cc] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#0c2340]">Verifying Admin Access...</h2>
          <p className="text-sm text-gray-500 mt-1">Checking Admin &amp; Co-Admin permissions.</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="py-16 bg-slate-50 min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-10 max-w-md w-full text-center shadow-lg space-y-6">
          <img
            src="/logo.jpg"
            alt="Adamya Logo"
            className="w-20 h-20 rounded-2xl object-cover mx-auto border border-gray-100 shadow-sm"
          />
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0055cc] bg-blue-50 px-3 py-1 rounded-full mb-3">
              <ShieldCheck size={14} /> Restricted Portal
            </span>
            <h1 className="text-2xl font-extrabold text-[#0c2340]">Admin &amp; Co-Admin Login</h1>
            <p className="text-sm text-gray-600 mt-2">
              Leads, Excel exports, and client quotations are private. Sign in with an authorized Admin or Co-Admin Google account.
            </p>
          </div>

          {notice && (
            <div className="p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs text-left space-y-2">
              <p>{notice.text}</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0769892128"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#0055cc] hover:underline"
                >
                  Open OAuth Test Users <ExternalLink size={12} />
                </a>
                {typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#0055cc] hover:underline"
                  >
                    Open Admin Portal in New Tab <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={handleGoogleLogin} disabled={isLoggingIn} className="gsi-material-button">
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={handleBasicLogin}
              disabled={isLoggingIn}
              className="text-xs font-semibold text-[#0055cc] hover:underline disabled:opacity-50"
            >
              Sign in without Gmail/Sheets permissions (Leads &amp; Excel only)
            </button>

            <button
              type="button"
              onClick={onBackToWebsite}
              className="text-sm font-medium text-gray-500 hover:text-[#0055cc] pt-1"
            >
              Return to Public Website
            </button>
          </div>
        </div>
      </section>
    );
  }

  // 2. Signed in, but NOT an Admin or Co-Admin -> Access Denied
  if (roleStatus === 'denied') {
    return (
      <section className="py-16 bg-slate-50 min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-red-200 p-8 sm:p-10 max-w-md w-full text-center shadow-lg space-y-5">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0c2340]">Access Denied</h1>
            <p className="text-sm text-gray-600 mt-2">
              The account <strong className="text-slate-800">{resolvedEmail || user.email || 'signed in'}</strong> is not authorized as an Admin or Co-Admin.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Please ask the Admin to add your email as a Co-Admin, or sign in with an Admin account.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button type="button" variant="secondary" onClick={handleSignOut} className="py-2.5 px-4 text-sm">
              Sign Out
            </Button>
            <Button type="button" variant="primary" onClick={onBackToWebsite} className="py-2.5 px-4 text-sm">
              Back to Public Website
            </Button>
          </div>
        </div>
      </section>
    );
  }

  // 3. Verified Admin or Co-Admin -> Full Leads, Excel, Gmail, WhatsApp & Quotation Desk
  return (
    <section className="py-8 md:py-10 bg-slate-50 min-h-[calc(100vh-5rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0055cc] mb-1">
              <ShieldCheck size={14} />
              {roleStatus === 'admin' ? 'Admin Workspace' : 'Co-Admin Workspace'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0c2340]">
              Leads &amp; Quotations Portal
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage enquiries from Website, Gmail &amp; WhatsApp, export to Excel/Sheets, and send quotations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {roleStatus === 'admin' && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowTeamPanel(!showTeamPanel)}
                className="py-2 px-3.5 text-sm gap-1.5"
              >
                <Users size={15} />
                Co-Admins ({coAdmins.length})
              </Button>
            )}

            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-800">
              <CheckCircle2 size={15} className="text-[#22c55e]" />
              <span className="font-semibold">{resolvedEmail || user.email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="ml-1 text-gray-500 hover:text-red-600 p-1"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Super Admin Co-Admin Management Panel */}
        {roleStatus === 'admin' && showTeamPanel && (
          <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#0c2340]">Manage Admin &amp; Co-Admin Access</h2>
                <p className="text-xs text-gray-500">
                  Primary Admins ({SUPER_ADMIN_EMAILS.join(', ')}) always have access. Add Co-Admin Gmail accounts below.
                </p>
              </div>
            </div>

            <form onSubmit={handleAddCoAdmin} className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
              <input
                type="email"
                required
                value={newCoAdminEmail}
                onChange={(e) => setNewCoAdminEmail(e.target.value)}
                placeholder="coadmin@gmail.com"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <Button type="submit" variant="primary" className="py-2 px-4 text-sm">
                Add Co-Admin
              </Button>
            </form>

            {coAdmins.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {coAdmins.map((member) => (
                  <div
                    key={member.email}
                    className="inline-flex items-center gap-2 bg-slate-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs"
                  >
                    <span className="font-semibold text-[#0c2340]">{member.email}</span>
                    <span className="text-[11px] text-[#0055cc] bg-blue-50 px-1.5 py-0.5 rounded">
                      {member.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoAdmin(member.email)}
                      className="text-gray-400 hover:text-red-600"
                      title="Remove Co-Admin"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workspace OAuth Notice if user reloaded page */}
        {!hasWorkspaceToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-900">
            <span>
              To fetch emails from Gmail or sync Google Sheets in this session, click <strong>Fetch from Gmail</strong> or reconnect Google Workspace permissions.
            </span>
            <Button type="button" variant="secondary" onClick={handleGoogleLogin} className="py-1.5 px-3 text-xs shrink-0">
              Reconnect Google Workspace
            </Button>
          </div>
        )}

        {/* Feedback Alert */}
        {notice && (
          <div
            className={`rounded-xl p-4 flex items-center gap-3 text-sm border ${
              notice.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <AlertCircle size={18} className="shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500">Total Enquiries</div>
            <div className="text-2xl font-extrabold text-[#0c2340] mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500">Pending Quote</div>
            <div className="text-2xl font-extrabold text-[#0055cc] mt-1">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500">Quotations Sent</div>
            <div className="text-2xl font-extrabold text-[#22c55e] mt-1">{stats.quoted}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-500">Total Quoted Value</div>
            <div className="text-2xl font-extrabold text-[#0c2340] mt-1">
              ₹{stats.totalValue.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Integrations Toolbar: Gmail + Excel + Google Sheets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-[#0c2340] uppercase tracking-wider">
              1. Fetch &amp; Export Client Data (Gmail &amp; Excel)
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="primary"
                onClick={handleFetchGmail}
                disabled={isLoadingGmail}
                className="py-2.5 px-4 text-sm gap-2"
              >
                <Mail size={16} />
                {isLoadingGmail ? 'Fetching Gmail...' : 'Fetch from Gmail'}
              </Button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="py-2.5 px-4 text-sm gap-2"
              >
                <Upload size={16} />
                Import Excel (.xlsx)
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => exportEnquiriesToExcel(enquiries)}
                disabled={enquiries.length === 0}
                className="py-2.5 px-4 text-sm gap-2 disabled:opacity-50"
              >
                <Download size={16} />
                Export Excel (.xlsx)
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAddLead(!showAddLead)}
                className="py-2.5 px-4 text-sm gap-1.5"
              >
                <Plus size={16} />
                Log WhatsApp / Call Lead
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0c2340] uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#22c55e]" />
                2. Google Sheets Live Sync
              </h2>
              {connectedSheetUrl && (
                <a
                  href={connectedSheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#0055cc] inline-flex items-center gap-1 hover:underline"
                >
                  Open Sheet <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="Paste Google Sheet URL or ID..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleFetchFromSheet}
                disabled={isSyncingSheet}
                className="py-2 px-3.5 text-xs gap-1.5"
              >
                <RefreshCw size={14} />
                Fetch Sheet
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!spreadsheetInput.trim()) {
                    setConfirmAction({ type: 'create_sheet' });
                  } else {
                    setConfirmAction({ type: 'sync_sheet' });
                  }
                }}
                disabled={isSyncingSheet}
                className="py-2 px-3.5 text-xs gap-1.5"
              >
                <FileSpreadsheet size={14} />
                {spreadsheetInput.trim() ? 'Sync to Sheet' : 'Create New Sheet'}
              </Button>
            </div>
          </div>
        </div>

        {/* Manual / WhatsApp Lead Form */}
        {showAddLead && (
          <form
            onSubmit={handleAddManualLead}
            className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[#0c2340]">Log New WhatsApp / Call Enquiry</h3>
              <button
                type="button"
                onClick={() => setShowAddLead(false)}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                required
                type="text"
                placeholder="Client Name *"
                value={manualLead.name}
                onChange={(e) => setManualLead((p) => ({ ...p, name: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <input
                required
                type="tel"
                placeholder="Phone / WhatsApp *"
                value={manualLead.phone}
                onChange={(e) => setManualLead((p) => ({ ...p, phone: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={manualLead.email}
                onChange={(e) => setManualLead((p) => ({ ...p, email: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <select
                value={manualLead.service}
                onChange={(e) => setManualLead((p) => ({ ...p, service: e.target.value }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0055cc]"
              >
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Electrical Solutions">Electrical Solutions</option>
                <option value="Mechanical Works">Mechanical Works</option>
                <option value="Plant Maintenance">Plant Maintenance</option>
                <option value="Power Systems">Power Systems</option>
                <option value="Turnkey Projects">Turnkey Projects</option>
              </select>
              <select
                value={manualLead.source}
                onChange={(e) => setManualLead((p) => ({ ...p, source: e.target.value as any }))}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0055cc]"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Website">Website</option>
                <option value="Gmail">Gmail</option>
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                required
                type="text"
                placeholder="Client requirement details *"
                value={manualLead.message}
                onChange={(e) => setManualLead((p) => ({ ...p, message: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
              <Button type="submit" variant="primary" className="py-2 px-5 text-sm">
                Save Lead
              </Button>
            </div>
          </form>
        )}

        {/* Leads Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client name, phone, email, or service..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#0055cc]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-[#0055cc]"
            >
              <option value="ALL">All Statuses</option>
              <option value="New">New</option>
              <option value="Quoted (Gmail)">Quoted (Gmail)</option>
              <option value="Quoted (WhatsApp)">Quoted (WhatsApp)</option>
            </select>
          </div>

          {filteredEnquiries.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              No client enquiries yet. Website enquiries submitted by customers will appear here automatically, or click{' '}
              <strong>Fetch from Gmail</strong> / <strong>Import Excel</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Service &amp; Requirement</th>
                    <th className="py-3.5 px-4">Source</th>
                    <th className="py-3.5 px-4">Status / Quote</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEnquiries.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-[#0c2340]">{item.name}</div>
                        {item.phone && <div className="text-xs text-gray-600">{item.phone}</div>}
                        {item.email && <div className="text-xs text-gray-500">{item.email}</div>}
                      </td>
                      <td className="py-3.5 px-4 align-top max-w-sm">
                        <span className="inline-block text-xs font-semibold text-[#0055cc] bg-blue-50 px-2 py-0.5 rounded-md mb-1">
                          {item.service}
                        </span>
                        <p className="text-xs text-gray-600 line-clamp-2">{item.message}</p>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                          {item.source}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md ${
                            item.status.startsWith('Quoted')
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.quotation && (
                          <div className="text-xs font-bold text-[#0c2340] mt-1">
                            {item.quotation.quoteNumber} • ₹
                            {item.quotation.totalAmount.toLocaleString('en-IN')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEnquiry(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0055cc] text-white text-xs font-semibold hover:bg-[#003399] transition-colors"
                          >
                            <FileText size={13} />
                            {item.quotation ? 'Edit Quote' : 'Create Quote'}
                          </button>

                          {item.phone && item.phone !== 'Not provided' && (
                            <a
                              href={buildWhatsAppQuickReplyUrl(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-semibold hover:bg-green-100"
                              title="Message on WhatsApp"
                            >
                              <MessageSquare size={13} />
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quotation Modal */}
      {selectedEnquiry && (
        <QuotationModal
          enquiry={selectedEnquiry}
          isGoogleSignedIn={hasWorkspaceToken}
          onRequestGoogleSignIn={async () => {
            await ensureWorkspaceToken();
          }}
          onClose={() => setSelectedEnquiry(null)}
          onSaveQuotation={async (id, quote, status) => {
            await updateEnquiryQuotationInDb(id, quote, status);
            setSelectedEnquiry((prev) =>
              prev && prev.id === id
                ? { ...prev, quotation: quote, status: status || prev.status }
                : prev
            );
          }}
        />
      )}

      {/* Confirmation Dialog for Google Sheets mutations */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.type === 'create_sheet'
            ? 'Create New Google Sheet?'
            : 'Sync Enquiries to Google Sheet?'
        }
        description={
          confirmAction?.type === 'create_sheet'
            ? 'This will create a new spreadsheet named "Adamya Power - Client Enquiries & Quotations" in your Google account and upload your current enquiries.'
            : 'This will append any unsynced client enquiry and quotation rows to your connected Google Sheet.'
        }
        details={[
          `Records to sync: ${enquiries.length}`,
          spreadsheetInput.trim() ? `Target Sheet ID: ${spreadsheetInput.trim()}` : 'New Spreadsheet',
        ]}
        confirmLabel={confirmAction?.type === 'create_sheet' ? 'Create & Sync' : 'Sync Now'}
        isLoading={isSyncingSheet}
        onConfirm={handleConfirmedSheetAction}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}
