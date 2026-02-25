const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
    private token: string | null = null;

    setToken(token: string) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('ins_token', token);
        }
    }

    getToken(): string | null {
        if (this.token) return this.token;
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('ins_token');
        }
        return this.token;
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('ins_token');
        }
    }

    private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {}),
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers,
        });

        if (res.status === 401) {
            this.clearToken();
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            throw new Error('Unauthorized');
        }

        const json = await res.json();

        if (!res.ok) {
            throw new Error(json.message || `API error: ${res.status}`);
        }

        return json;
    }

    // Auth
    async login(email: string, password: string) {
        const res = await this.request<{ data: { token: string; user: any } }>(
            '/api/v1/auth/login',
            { method: 'POST', body: JSON.stringify({ email, password }) },
        );
        this.setToken(res.data.token);
        return res.data;
    }

    async getProfile() {
        return this.request<{ data: any }>('/api/v1/auth/me');
    }

    // Brands
    async getBrands(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/brands${qs}`);
    }

    async getBrand(id: string) {
        return this.request<{ data: any }>(`/api/v1/brands/${id}`);
    }

    async createBrand(data: any) {
        return this.request<{ data: any }>('/api/v1/brands', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateBrand(id: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/brands/${id}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async updateBrandStatus(id: string, status: string) {
        return this.request<{ data: any }>(`/api/v1/brands/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    }

    async deleteBrand(id: string) {
        return this.request<{ data: any }>(`/api/v1/brands/${id}`, { method: 'DELETE' });
    }

    // Brand Contacts
    async getBrandContacts(brandId: string) {
        return this.request<{ data: any[] }>(`/api/v1/brands/${brandId}/contacts`);
    }

    async createBrandContact(brandId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/brands/${brandId}/contacts`, {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateBrandContact(brandId: string, contactId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/brands/${brandId}/contacts/${contactId}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async deleteBrandContact(brandId: string, contactId: string) {
        return this.request<any>(`/api/v1/brands/${brandId}/contacts/${contactId}`, { method: 'DELETE' });
    }

    // Brand Contracts
    async getBrandContracts(brandId: string) {
        return this.request<{ data: any[] }>(`/api/v1/brands/${brandId}/contracts`);
    }

    async createBrandContract(brandId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/brands/${brandId}/contracts`, {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    // Collections
    async getCollections(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/collections${qs}`);
    }

    async getCollection(id: string) {
        return this.request<{ data: any }>(`/api/v1/collections/${id}`);
    }

    async createCollection(brandId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/brands/${brandId}/collections`, {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    // Products
    async getProducts(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/products${qs}`);
    }

    async getProduct(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/${id}`);
    }

    async createProduct(collectionId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/collections/${collectionId}/products`, {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    // Colorways
    async getColorways(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/colorways${qs}`);
    }

    async getColorway(id: string) {
        return this.request<{ data: any }>(`/api/v1/colorways/${id}`);
    }

    async createColorway(productId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/colorways`, {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    // Pricing
    async getPricing(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/pricing${qs}`);
    }

    async createPrice(data: any) {
        return this.request<{ data: any }>('/api/v1/pricing', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async reviewPrice(id: string, data: { status: string; reviewNotes?: string }) {
        return this.request<{ data: any }>(`/api/v1/pricing/${id}/review`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    }

    // Health
    async getHealth() {
        return this.request<any>('/api/v1/health');
    }

    // Warehouses
    async getWarehouses(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/warehouses${qs}`);
    }

    async createWarehouse(data: any) {
        return this.request<{ data: any }>('/api/v1/warehouses', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    // Inventory
    async getInventory(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/inventory${qs}`);
    }

    async upsertInventory(data: any) {
        return this.request<{ data: any }>('/api/v1/inventory', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async adjustStock(id: string, data: { adjustment: number; reason?: string }) {
        return this.request<{ data: any }>(`/api/v1/inventory/${id}/adjust`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    }

    // Orders
    async getOrders(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/orders${qs}`);
    }

    async getOrder(id: string) {
        return this.request<{ data: any }>(`/api/v1/orders/${id}`);
    }

    async getOrdersSummary() {
        return this.request<{ data: any }>('/api/v1/orders/summary');
    }

    async createOrder(data: any) {
        return this.request<{ data: any }>('/api/v1/orders', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateOrderStatus(id: string, status: string) {
        return this.request<{ data: any }>(`/api/v1/orders/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    }

    // Shopify Stores
    async getStores(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/shopify-stores${qs}`);
    }

    async connectStore(data: {
        shopifyDomain: string;
        storeName?: string;
        clientId: string;
        clientSecret: string;
    }) {
        return this.request<{ data: any }>('/api/v1/shopify-stores', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async getStore(id: string) {
        return this.request<{ data: any }>(`/api/v1/shopify-stores/${id}`);
    }

    async updateStore(id: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/shopify-stores/${id}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async toggleStore(id: string) {
        return this.request<{ data: any }>(`/api/v1/shopify-stores/${id}/toggle`, {
            method: 'PATCH',
        });
    }

    async deleteStore(id: string) {
        return this.request<{ message: string }>(`/api/v1/shopify-stores/${id}`, {
            method: 'DELETE',
        });
    }

    async testStoreConnection(id: string) {
        return this.request<{ data: any }>(`/api/v1/shopify-stores/${id}/test-connection`);
    }

    async getStoreSyncLogs(id: string, params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/shopify-stores/${id}/sync-logs${qs}`);
    }
}

export const api = new ApiClient();
