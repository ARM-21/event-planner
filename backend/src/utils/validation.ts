/**
 * Small helper for turning a zod validation error into the per-field
 * error list the API's error responses use, so routes don't each have to
 * reshape zod's own error format by hand.
 */

import type { ZodError } from 'zod';
import type { FieldError } from './errors';

export function zodIssuesToDetails(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({ field: String(issue.path[0] ?? ''), message: issue.message }));
}
