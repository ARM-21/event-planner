import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { verifyEmail } from '../api/auth/verify-email';
import { useAuth } from '../contexts/auth';
import { Button, Card } from '../components/ui';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, updateUser } = useAuth();

  // Guards against the effect firing twice (React 18 StrictMode) and
  // burning the single-use token on its own verify call.
  const attempted = useRef(false);

  const mutation = useMutation({
    mutationFn: () => verifyEmail(token),
    onSuccess: () => {
      if (user) updateUser({ emailVerified: true });
    },
  });

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const message = !token
    ? 'Missing verification token.'
    : mutation.isError
      ? mutation.error instanceof ApiError
        ? mutation.error.message
        : 'Verification failed.'
      : mutation.isSuccess
        ? 'Your email has been verified.'
        : 'Verifying your email…';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm text-center">
        <p className={mutation.isError || !token ? 'text-red-600' : 'text-gray-700'}>{message}</p>
        <Link to="/events" className="mt-4 inline-block">
          <Button variant="secondary">Back to events</Button>
        </Link>
      </Card>
    </div>
  );
}
