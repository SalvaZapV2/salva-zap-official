import type {
  User,
  Shop,
  WabaAccount,
  Conversation,
  Message,
  Template,
  Campaign,
  CampaignCost,
  PaginatedResponse,
  DashboardStats,
} from './types';

// In production we serve the frontend and backend from the same origin.
// Use a relative /api base by default so it works with the Vite dev proxy
// and with the NestJS backend serving the frontend on the same port.
const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        this.setToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired. Please login again.');
      }
      
      const error = await response.json().catch(() => ({ 
        message: `Request failed with status ${response.status}` 
      }));
      throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const data = await this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  async register(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const data = await this.request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.access_token);
    return data;
  }

  // Shops
  async getShops(): Promise<Shop[]> {
    return this.request<Shop[]>('/shops');
  }

  async createShop(name: string): Promise<Shop> {
    return this.request<Shop>('/shops', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getShop(id: string): Promise<Shop> {
    return this.request<Shop>(`/shops/${id}`);
  }

  async updateShop(id: string, name: string): Promise<Shop> {
    return this.request<Shop>(`/shops/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteShop(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/shops/${id}`, {
      method: 'DELETE',
    });
  }

  async getUserProfile(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateUserEmail(email: string): Promise<User> {
    return this.request<User>('/auth/email', {
      method: 'PUT',
      body: JSON.stringify({ email }),
    });
  }

  // WABA
  async getEmbeddedSignupUrl(shopId?: string, connectionType: 'new' | 'existing' = 'new'): Promise<{ url: string }> {
    const params = new URLSearchParams();
    if (shopId) params.append('shopId', shopId);
    if (connectionType) params.append('connectionType', connectionType);
    return this.request<{ url: string }>(`/waba/embedded/start?${params.toString()}`);
  }

  async refreshWabaToken(wabaAccountId: string): Promise<{ id: string; wabaId: string; tokenExpiresAt?: string | null }> {
    return this.request<{ id: string; wabaId: string; tokenExpiresAt?: string | null }>(`/waba/${wabaAccountId}/refresh`, {
      method: 'POST',
    });
  }

  async registerWebhook(wabaAccountId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/waba/${wabaAccountId}/webhook/register`, {
      method: 'POST',
    });
  }

  // Messages
  async sendMessage(
    wabaAccountId: string,
    to: string,
    body: string,
    clientMessageId?: string,
  ): Promise<any> {
    return this.request<any>('/messages/send', {
      method: 'POST',
      body: JSON.stringify({ wabaAccountId, to, body, clientMessageId }),
    });
  }

  async sendTemplateMessage(
    wabaAccountId: string,
    to: string,
    templateName: string,
    language: string,
    parameters?: string[],
    clientMessageId?: string,
  ): Promise<any> {
    return this.request<any>('/messages/template', {
      method: 'POST',
      body: JSON.stringify({
        wabaAccountId,
        to,
        templateName,
        language,
        parameters,
        clientMessageId,
      }),
    });
  }

  // Inbox
  async getConversations(
    wabaAccountId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResponse<Conversation>> {
    return this.request<PaginatedResponse<Conversation>>(
      `/inbox/conversations?wabaAccountId=${wabaAccountId}&page=${page}&limit=${limit}`,
    );
  }

  async getConversationMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<PaginatedResponse<Message>> {
    return this.request<PaginatedResponse<Message>>(
      `/inbox/conversations/${conversationId}?page=${page}&limit=${limit}`,
    );
  }

  async markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/inbox/conversations/${conversationId}/read`, {
      method: 'PUT',
    });
  }

  // Templates
  async getTemplates(wabaAccountId: string): Promise<Template[]> {
    return this.request<Template[]>(`/templates?wabaAccountId=${wabaAccountId}`);
  }

  async submitTemplate(wabaAccountId: string, templateData: any): Promise<Template> {
    return this.request<Template>(`/templates/submit?wabaAccountId=${wabaAccountId}`, {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async updateTemplate(id: string, status: string, history?: any): Promise<Template> {
    return this.request<Template>(`/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, history }),
    });
  }

  // Campaigns
  async getCampaigns(wabaAccountId: string): Promise<Campaign[]> {
    return this.request<Campaign[]>(`/campaigns?wabaAccountId=${wabaAccountId}`);
  }

  async createCampaign(
    wabaAccountId: string,
    templateId: string | null,
    contactNumbers: string[],
  ): Promise<Campaign> {
    return this.request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify({ wabaAccountId, templateId, contactNumbers }),
    });
  }

  async getCampaign(id: string): Promise<Campaign> {
    return this.request<Campaign>(`/campaigns/${id}`);
  }

  async getCampaignCost(templateId: string | null, contactCount: number): Promise<CampaignCost> {
    const params = new URLSearchParams({
      contactCount: contactCount.toString(),
    });
    if (templateId) {
      params.append('templateId', templateId);
    }
    return this.request<CampaignCost>(`/campaigns/cost?${params.toString()}`);
  }

  // Dashboard
  async getDashboardStats(wabaAccountId: string): Promise<DashboardStats> {
    return this.request<DashboardStats>(`/dashboard/stats?wabaAccountId=${wabaAccountId}`);
  }
}

export const api = new ApiClient(API_BASE_URL);
