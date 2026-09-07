import type { ZodError } from 'zod';
import type { FieldError } from './errors';

export function zodIssuesToDetails(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message }));
}
