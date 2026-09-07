import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { login } from '../api/auth/login';
import { verifyTwoFactor } from '../api/auth/verify-two-factor';
import { isTwoFactorRequired } from '../api/auth/types';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/auth';
import { loginSchema, type LoginFormValues } from '../lib/schemas';
import { Button, ErrorBanner, Field, Input, PasswordInput } from '../components/ui';
import { AuthLayout } from '../components/AuthLayout';
import { ROUTES } from '../config/routes';

export default function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  // Set once `login` responds with `twoFactorRequired` — its presence is
  // what switches the form from "email + password" to "enter your code".
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values.email, values.password),
    onSuccess: (result) => {
      if (isTwoFactorRequired(result)) {
        setPreAuthToken(result.preAuthToken);
        return;
      }
      setSession(result);
      navigate(ROUTES.EVENTS);
    },
    onError: (err) => {
      setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyTwoFactor(preAuthToken as string, code),
    onSuccess: (data) => {
      setSession(data);
      navigate(ROUTES.EVENTS);
    },
    onError: (err) => {
      setCodeError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  if (preAuthToken) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-bold text-gray-900">Enter your code</h1>
        <p className="mt-1 text-sm text-gray-500">Open your authenticator app and enter the 6-digit code.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCodeError(null);
            verifyMutation.mutate();
          }}
          className="mt-6 space-y-4"
          noValidate
        >
          <Field label="6-digit code" htmlFor="code" error={codeError ?? undefined}>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
          </Field>
          <Button type="submit" className="w-full" disabled={code.length !== 6 || verifyMutation.isPending}>
            {verifyMutation.isPending ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            onClick={() => {
              setPreAuthToken(null);
              setCode('');
              setCodeError(null);
            }}
            className="w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Back to login
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
      <p className="mt-1 text-sm text-gray-500">Log in to your account</p>
      <form onSubmit={handleSubmit((values) => loginMutation.mutate(values))} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
        </Field>
        {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}
        <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link to={ROUTES.REGISTER} className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
