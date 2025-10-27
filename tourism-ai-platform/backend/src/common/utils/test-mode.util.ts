export const isTestMode = (provider: 'stripe' | 'iyzico'): boolean => {
  if (provider === 'stripe') {
    return !process.env.STRIPE_SECRET_KEY;
  }
  if (provider === 'iyzico') {
    return !process.env.IYZICO_API_KEY || !process.env.IYZICO_SECRET_KEY;
  }
  return false;
};
