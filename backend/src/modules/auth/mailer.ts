import { logger } from '../../utils/logger';

// dev stub — logs the link instead of sending a real email

export function sendVerificationEmail(to: string, link: string): void {
  logger.info('Verification email sent (dev stub)', { to, link });
}
