/** Mirrors frontend `buildCustomerCredentialsWhatsAppMessage` (customer-credentials-whatsapp.ts). */
export function buildCustomerCredentialsWhatsAppMessage(opts: {
  firstName: string;
  phone: string;
  password: string;
  businessName: string;
  customerPortalUrl: string;
}): string {
  const first = opts.firstName.trim().split(/\s+/)[0] || opts.firstName.trim();
  return [
    `Welcome to ${opts.businessName}, ${first}!`,
    ``,
    `Your customer portal login details:`,
    `Phone: ${opts.phone}`,
    `Password: ${opts.password}`,
    ``,
    `Login here: ${opts.customerPortalUrl}`,
    ``,
    `Please keep this password safe — you can change it anytime after logging in.`,
  ].join("\n");
}
