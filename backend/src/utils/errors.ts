export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: FieldError[]) =>
  new AppError(400, message, details);
export const unauthorized = (message = 'Invalid credentials') => new AppError(401, message);
export const forbidden = (message = 'Not authorized') => new AppError(403, message);
export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message: string) => new AppError(409, message);
export const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(429, message);
