export interface User {
  id: string;
  email: string;
}

export interface WabaAccount {
  id: string;
  shopId: string;
  wabaId: string;
  phoneId: string;
  displayNumber: string;
  webhookVerified: boolean;
  tokenExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: string;
  waba?: WabaAccount[];
}

export interface Conversation {
  id: string;
  contactNumber: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  status?: string;
}

export interface Message {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  timestamp: string;
  status: string;
}

export type TemplateStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Template {
  id: string;
  wabaAccountId: string;
  name: string;
  language: string;
  status: TemplateStatus;
  history?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface Campaign {
  id: string;
  wabaAccountId: string;
  templateId: string | null;
  contactCount: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  failedCount?: number;
}

export interface CampaignCost {
  totalCost: number;
  costPerMessage: number;
  currency: string;
  breakdown: {
    messageCount: number;
    costPerUnit: number;
  };
  usdCost: number;
  brlCost: number;
  pricingModel: string;
  contactCount: number;
}

export interface DashboardStats {
  messages_sent_24h: number;
  messages_delivered_24h: number;
  messages_read_24h: number;
  messages_failed_24h: number;
  active_conversations: number;
  queue_size: number;
  delivery_rate: number;
  read_rate: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
