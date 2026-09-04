// Development mode -- switching to node mailer afterward
export function sendVerificationEmail(to: string, link: string): void {
  console.log(`[mailer] Verification email for ${to}: ${link}`);
}
