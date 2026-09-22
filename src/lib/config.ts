// Server-side VIP pricing configuration for CupidX
export interface VipPlanConfig {
  name: string;
  code: string;
  priceInr: number;
  pricePaise: number;
  durationDays: number;
  badge?: string;
  description: string;
}

export const VIP_PLANS: Record<string, VipPlanConfig> = {
  VIP_MONTHLY: {
    name: '1 Month VIP',
    code: 'VIP_MONTHLY',
    priceInr: 29,
    pricePaise: 2900,
    durationDays: 30,
    badge: 'Popular',
    description: 'Instant matchmaking, gender filters & custom avatars for 30 days',
  },
  VIP_YEARLY: {
    name: '6 Months VIP Pass',
    code: 'VIP_YEARLY',
    priceInr: 199,
    pricePaise: 19900,
    durationDays: 180,
    badge: 'Best Value',
    description: 'Full VIP privileges for 6 months at massive discount',
  },
};

export const VIP_CONFIG = {
  PLAN_NAME: 'Cupidx VIP Membership',
  PLAN_CODE: 'VIP_MONTHLY',
  PRICE_INR: 29,
  PRICE_PAISE: 2900,
  CURRENCY: 'INR',
  DURATION_DAYS: 30,
};
