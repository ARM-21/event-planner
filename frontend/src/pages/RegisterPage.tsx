import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { register as registerRequest } from '../api/auth/register';
import { ApiError } from '../api/client';
import { useAuth } from '../contexts/auth';
import { registerSchema, type RegisterFormValues } from '../lib/schemas';
import { Button, Card, Field, Input } from '../components/ui';

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
      navigate('/events');
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Create an account</h1>
        <form onSubmit={handleSubmit((values) => registerMutation.mutate(values))} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" autoComplete="name" {...register('name')} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          </Field>
          {errors.root && (
            <p role="alert" className="text-sm text-red-600">
              {errors.root.message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
