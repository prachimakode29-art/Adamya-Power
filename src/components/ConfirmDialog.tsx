import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  details = [],
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0055cc] flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold text-[#0c2340]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
            aria-label="Close confirmation dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
          {details.length > 0 && (
            <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 space-y-1.5 text-xs text-slate-700">
              {details.map((line, i) => (
                <div key={i} className="break-words">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 bg-slate-50 border-t border-gray-100">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            className="py-2.5 px-4 text-sm"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading}
            className="py-2.5 px-5 text-sm disabled:opacity-60"
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
