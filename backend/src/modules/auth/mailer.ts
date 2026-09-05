/**
 * Sends the email-verification link to a user. This is the one place that
 * knows how to actually deliver that email, so swapping in a real email
 * provider later only means changing this file.
 *
 * Development mode -- switching to a real mailer afterward. For now it
 * just logs the link so a developer can copy it out of the console.
 */

import { logger } from '../../utils/logger';

export function sendVerificationEmail(to: string, link: string): void {
  logger.info('Verification email sent (dev stub)', { to, link });
}
