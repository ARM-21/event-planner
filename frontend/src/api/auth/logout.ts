import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';

export async function logoutRequest(): Promise<void> {
  await apiClient.post(ROUTES.API.AUTH.LOGOUT);
}
