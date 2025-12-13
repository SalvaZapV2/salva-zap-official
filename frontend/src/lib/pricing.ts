export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface MetaPricing {
  country: string;
  countryCode: string;
  category: TemplateCategory;
  priceUSD: number;
}

// Meta WhatsApp Cloud API Pricing (simplified for Brazil)
export const metaPricingTable: MetaPricing[] = [
  // Brazil
  { country: "Brazil", countryCode: "BR", category: "MARKETING", priceUSD: 0.0925 },
  { country: "Brazil", countryCode: "BR", category: "UTILITY", priceUSD: 0.0210 },
  { country: "Brazil", countryCode: "BR", category: "AUTHENTICATION", priceUSD: 0.0450 },
  // United States
  { country: "United States", countryCode: "US", category: "MARKETING", priceUSD: 0.0270 },
  { country: "United States", countryCode: "US", category: "UTILITY", priceUSD: 0.0055 },
  { country: "United States", countryCode: "US", category: "AUTHENTICATION", priceUSD: 0.0095 },
  // India
  { country: "India", countryCode: "IN", category: "MARKETING", priceUSD: 0.0140 },
  { country: "India", countryCode: "IN", category: "UTILITY", priceUSD: 0.0040 },
  { country: "India", countryCode: "IN", category: "AUTHENTICATION", priceUSD: 0.0025 },
  // Mexico
  { country: "Mexico", countryCode: "MX", category: "MARKETING", priceUSD: 0.0680 },
  { country: "Mexico", countryCode: "MX", category: "UTILITY", priceUSD: 0.0300 },
  { country: "Mexico", countryCode: "MX", category: "AUTHENTICATION", priceUSD: 0.0350 },
];

export const USD_TO_BRL = 5.85; // Exchange rate (mock - should be fetched from API in production)

export function getPricing(countryCode: string, category: TemplateCategory): number {
  const pricing = metaPricingTable.find(
    (p) => p.countryCode === countryCode && p.category === category
  );
  return pricing?.priceUSD || 0;
}

export function calculateCampaignCost(
  contactCount: number,
  pricePerMessage: number
): { totalUSD: number; totalBRL: number } {
  const totalUSD = contactCount * pricePerMessage;
  const totalBRL = totalUSD * USD_TO_BRL;
  return { totalUSD, totalBRL };
}
