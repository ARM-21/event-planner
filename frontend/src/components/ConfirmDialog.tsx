import { Modal } from './Modal';
import { Button } from './ui';

// Built on Modal — the one shape every "are you sure?" prompt in the app needs.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isConfirming = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-dialog-title">
      <h2 id="confirm-dialog-title" className="text-base font-semibold text-gray-900">
        {title}
      </h2>
      {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isConfirming}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={variant} onClick={onConfirm} disabled={isConfirming}>
          {isConfirming ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
