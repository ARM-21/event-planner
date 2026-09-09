import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { register as registerRequest } from '../api/auth/register';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/auth';
import { registerSchema, type RegisterFormValues } from '../lib/schemas';
import { Button, ErrorBanner, Field, Input, PasswordInput } from '../components/ui';
import { AuthLayout } from '../components/AuthLayout';
import { ROUTES } from '../config/routes';

export default function RegisterPage() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterFormValues) => registerRequest(values.name, values.email, values.password),
    onSuccess: (data) => {
      setSession(data);
      navigate(ROUTES.EVENTS);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details && err.details.length > 0) {
        for (const detail of err.details) {
          setError(detail.field as keyof RegisterFormValues, { message: detail.message });
        }
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      }
    },
  });

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
      <p className="mt-1 text-sm text-gray-500">Start planning your first event</p>
      <form onSubmit={handleSubmit((values) => registerMutation.mutate(values))} className="mt-6 space-y-4" noValidate>
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" placeholder="Adam Eve" {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        </Field>
        {errors.root && <ErrorBanner>{errors.root.message}</ErrorBanner>}
        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to={ROUTES.LOGIN} className="font-medium text-indigo-600 hover:text-indigo-500">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
