'use client';

import { useRef } from 'react';
import { ExternalLink, Upload, X, FileText } from 'lucide-react';

export const REGISTRATION_PAYMENT_STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'PAY_SUCCESS', label: 'Completed (paid)' },
] as const;

export type RegistrationPaymentStatus = (typeof REGISTRATION_PAYMENT_STATUS_OPTIONS)[number]['value'];

export function paymentStatusLabel(status: string | null | undefined): string {
    if (status === 'PAY_SUCCESS') return 'Completed';
    if (status === 'pending') return 'Pending';
    return status || 'Pending';
}

export type RegistrationPaymentAttachmentProps = {
    receiptPath?: string | null;
    transactionReference?: string | null;
    paymentStatus?: string | null;
    isEditing: boolean;
    canEdit: boolean;
    pendingPreview: string | null;
    onReceiptPathChange: (path: string | null) => void;
    onTransactionReferenceChange: (ref: string) => void;
    onPaymentStatusChange: (status: RegistrationPaymentStatus) => void;
    onPendingFile: (file: File | null, previewUrl: string | null) => void;
};

function isPdfPath(path: string) {
    return path.toLowerCase().includes('.pdf');
}

/** Upload receipt to `/api/upload`; returns public file path or null on failure. */
export async function uploadRegistrationReceipt(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.filePath) return null;
    return String(data.filePath);
}

export function RegistrationPaymentAttachment({
    receiptPath,
    transactionReference,
    paymentStatus,
    isEditing,
    canEdit,
    pendingPreview,
    onReceiptPathChange,
    onTransactionReferenceChange,
    onPaymentStatusChange,
    onPendingFile,
}: RegistrationPaymentAttachmentProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const displayPath = pendingPreview || receiptPath || null;
    const showEditor = isEditing && canEdit;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        onPendingFile(file, preview);
        e.target.value = '';
    };

    const handleRemove = () => {
        onPendingFile(null, null);
        onReceiptPathChange(null);
    };

    const statusValue =
        paymentStatus === 'PAY_SUCCESS' ? 'PAY_SUCCESS' : 'pending';

    return (
        <div className="space-y-3">
            <div>
                <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase">Payment status</p>
                {showEditor ? (
                    <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                        value={statusValue}
                        onChange={(e) =>
                            onPaymentStatusChange(e.target.value as RegistrationPaymentStatus)
                        }
                    >
                        {REGISTRATION_PAYMENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span
                        className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                            statusValue === 'PAY_SUCCESS'
                                ? 'bg-[#F0FDF4] text-[#22C55E]'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                        {paymentStatusLabel(paymentStatus)}
                    </span>
                )}
            </div>

            {!showEditor && transactionReference?.trim() && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500">Transaction reference</p>
                    <p className="text-sm font-mono font-medium text-gray-900">{transactionReference}</p>
                </div>
            )}
            {showEditor && (
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">Transaction reference (optional)</label>
                    <input
                        type="text"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Bank / Telebirr reference number"
                        value={transactionReference ?? ''}
                        onChange={(e) => onTransactionReferenceChange(e.target.value)}
                    />
                </div>
            )}

            <div>
                <p className="text-xs text-gray-500 mb-2 font-semibold uppercase">Payment receipt</p>

                {displayPath && !showEditor && <ReceiptPreview path={displayPath} />}

                {displayPath && showEditor && (
                    <div className="space-y-2">
                        <ReceiptPreview path={displayPath} />
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
                        >
                            <X className="w-3.5 h-3.5" /> Remove receipt
                        </button>
                    </div>
                )}

                {!displayPath && !showEditor && (
                    <p className="text-sm text-gray-400 italic py-2">No receipt uploaded</p>
                )}

                {showEditor && (
                    <div className="mt-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-[#22C55E] hover:border-[#22C55E]/40 hover:bg-[#F0FDF4] transition"
                        >
                            <Upload className="w-4 h-4" />
                            {displayPath ? 'Replace receipt' : 'Upload receipt (image or PDF)'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReceiptPreview({ path }: { path: string }) {
    if (isPdfPath(path)) {
        return (
            <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition"
            >
                <FileText className="w-8 h-8 text-red-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800">View PDF receipt</span>
                <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
            </a>
        );
    }

    return (
        <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            <img src={path} alt="Payment receipt" className="w-full h-auto max-h-60 object-contain mx-auto" />
            <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-xl">
                    <ExternalLink className="w-3 h-3" /> View full size
                </span>
            </a>
        </div>
    );
}
