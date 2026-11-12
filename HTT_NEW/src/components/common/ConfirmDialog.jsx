import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

/** @param {{open: boolean, onOpenChange: (open: boolean) => void, title: React.ReactNode, description?: React.ReactNode, confirmLabel?: string, destructive?: boolean, onConfirm: () => void | Promise<void>}} props */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'That action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[16px]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[12.5px]">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-[12.5px] text-rose-600">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handle}
            disabled={busy}
            className={destructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0B1F3A] hover:bg-[#132E52]'}
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
