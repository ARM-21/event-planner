import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setupTwoFactor, type SetupTwoFactorResult } from '../api/auth/setup-two-factor';
import { enableTwoFactor } from '../api/auth/enable-two-factor';
import { disableTwoFactor } from '../api/auth/disable-two-factor';
import { ApiError, getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/auth';

// Owns the setup -> enable / confirm -> disable flow's local state and
// mutations together, since they share state (setup, code, disablePassword)
// rather than being independent actions.
export function useTwoFactor() {
  const { token, updateUser } = useAuth();
  const [setup, setSetup] = useState<SetupTwoFactorResult | null>(null);
  const [code, setCode] = useState('');
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: () => setupTwoFactor(token as string),
    onSuccess: (result) => setSetup(result),
    onError: (err) => {
      // A 409 here means the backend's own state disagrees with this tab's
      if (err instanceof ApiError && err.status === 409) {
        updateUser({ twoFactorEnabled: true });
        toast.info('Two-factor authentication was already enabled in another session.');
        return;
      }
      toast.error(getErrorMessage(err, 'Failed to start 2FA setup.'));
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => enableTwoFactor(code, token as string),
    onSuccess: () => {
      updateUser({ twoFactorEnabled: true });
      setSetup(null);
      setCode('');
      toast.success('Two-factor authentication enabled');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Invalid code.')),
  });

  const disableMutation = useMutation({
    mutationFn: () => disableTwoFactor(disablePassword, token as string),
    onSuccess: () => {
      updateUser({ twoFactorEnabled: false });
      setConfirmingDisable(false);
      setDisablePassword('');
      toast.success('Two-factor authentication disabled');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Incorrect password.')),
  });

  return {
    setup,
    startSetup: () => setupMutation.mutate(),
    isStarting: setupMutation.isPending,
    cancelSetup: () => setSetup(null),

    code,
    setCode,
    confirmEnable: () => enableMutation.mutate(),
    isEnabling: enableMutation.isPending,

    confirmingDisable,
    startDisable: () => setConfirmingDisable(true),
    cancelDisable: () => {
      setConfirmingDisable(false);
      setDisablePassword('');
    },
    disablePassword,
    setDisablePassword,
    confirmDisable: () => disableMutation.mutate(),
    isDisabling: disableMutation.isPending,
  };
}
