import { logger } from '../../utils/logger';

// Development mode -- switching to node mailer afterward
export function sendVerificationEmail(to: string, link: string): void {
  logger.info('Verification email sent (dev stub)', { to, link });
}
