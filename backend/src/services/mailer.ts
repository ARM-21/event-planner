import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// No RESEND_API_KEY in dev — log the link instead of sending a real email.
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  if (!resend) {
    logger.info('Verification email sent (dev stub)', { to, link });
    return;
  }

  await resend.emails.send({
    from: env.emailFrom,
    to,
    subject: 'Verify your Evently email',
    html: `<p>Click <a href="${link}">here</a> to verify your email.</p>`,
  });
}
