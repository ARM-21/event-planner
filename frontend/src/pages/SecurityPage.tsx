import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { setupTwoFactor, type SetupTwoFactorResult } from '../api/auth/setup-two-factor';
import { enableTwoFactor } from '../api/auth/enable-two-factor';
import { disableTwoFactor } from '../api/auth/disable-two-factor';
import { ApiError, getErrorMessage } from '../api/client';
import { useAuth } from '../contexts/auth';
import { AppShell } from '../components/AppShell';
import { Button, Card, Field, Input, PasswordInput } from '../components/ui';

export default function SecurityPage() {
  const { user, token, updateUser } = useAuth();
  const [setup, setSetup] = useState<SetupTwoFactorResult | null>(null);
  const [code, setCode] = useState('');
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  const setupMutation = useMutation({
    mutationFn: () => setupTwoFactor(token as string),
    onSuccess: (result) => setSetup(result),
    onError: (err) => {
      // A 409 here means the backend's own state disagrees with this tab's
      // local copy of `user` — most commonly because 2FA was enabled from
      // a different session (another tab/device) after this one loaded.
      // Self-heal instead of just showing an error and leaving the UI
      // stuck offering an "Enable" button that will only ever 409 again.
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

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>

        <Card>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden="true" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Two-factor authentication</h2>
              <p className="mt-1 text-sm text-gray-500">
                Require a 6-digit code from an authenticator app in addition to your password.
              </p>
            </div>
          </div>

          {user?.twoFactorEnabled ? (
            confirmingDisable ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  disableMutation.mutate();
                }}
                className="mt-5 space-y-3"
                noValidate
              >
                <Field label="Enter your password to confirm" htmlFor="disable-password">
                  <PasswordInput
                    id="disable-password"
                    autoComplete="current-password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    autoFocus
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" disabled={!disablePassword || disableMutation.isPending}>
                    {disableMutation.isPending ? 'Disabling…' : 'Confirm & disable'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setConfirmingDisable(false);
                      setDisablePassword('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex items-center justify-between rounded-md bg-emerald-50 px-4 py-3">
                <span className="text-sm font-medium text-emerald-800">Enabled</span>
                <Button variant="danger" onClick={() => setConfirmingDisable(true)}>
                  Disable
                </Button>
              </div>
            )
          ) : setup ? (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-gray-600">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.).
              </p>
              <img src={setup.qrCodeDataUrl} alt="2FA QR code" className="mx-auto h-40 w-40" />
              <p className="text-center text-xs text-gray-500">
                Can&apos;t scan it? Enter this code manually:{' '}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{setup.secret}</code>
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enableMutation.mutate();
                }}
                className="space-y-3"
                noValidate
              >
                <Field label="Enter the 6-digit code to confirm" htmlFor="totp-code">
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" disabled={code.length !== 6 || enableMutation.isPending}>
                    {enableMutation.isPending ? 'Confirming…' : 'Confirm & enable'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setSetup(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-5">
              <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
                {setupMutation.isPending ? 'Starting…' : 'Enable two-factor authentication'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
