import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/auth';
import { useTwoFactor } from '../hooks/use-two-factor';
import { Button, Card, Field, Input, PasswordInput } from '../components/ui';

export default function SecurityPage() {
  const { user } = useAuth();
  const {
    setup,
    startSetup,
    isStarting,
    cancelSetup,
    code,
    setCode,
    confirmEnable,
    isEnabling,
    confirmingDisable,
    startDisable,
    cancelDisable,
    disablePassword,
    setDisablePassword,
    confirmDisable,
    isDisabling,
  } = useTwoFactor();

  return (
    <>
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
                  confirmDisable();
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
                  <Button type="submit" variant="danger" disabled={!disablePassword || isDisabling}>
                    {isDisabling ? 'Disabling…' : 'Confirm & disable'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancelDisable}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-5 flex items-center justify-between rounded-md bg-emerald-50 px-4 py-3">
                <span className="text-sm font-medium text-emerald-800">Enabled</span>
                <Button variant="danger" onClick={startDisable}>
                  Disable
                </Button>
              </div>
            )
          ) : setup ? (
            <div className="mt-5 space-y-4">
              <p className="text-[0.8rem] text-gray-600 md:text-base">
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
                  confirmEnable();
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
                  <Button type="submit" disabled={code.length !== 6 || isEnabling}> 
                    {isEnabling ? 'Confirming…' : 'Confirm & enable'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancelSetup}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="mt-5">
              <Button onClick={startSetup} disabled={isStarting}>
                {isStarting ? 'Starting…' : 'Enable two-factor authentication'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
