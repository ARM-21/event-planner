import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { login } from '../api/auth/login';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/auth';
import { loginSchema, type LoginFormValues } from '../lib/schemas';
import { Button, ErrorBanner, Field, Input, PasswordInput } from '../components/ui';
import { AuthLayout } from '../components/AuthLayout';

export default function LoginPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormValues) => login(values.email, values.password),
    onSuccess: (data) => {
      setSession(data);
      navigate('/events');
    },
    onError: (err) => {
      setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    },
  });

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
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
