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

    async getOrderLogs(orderId: string) {
        return this.request<{ data: any[] }>(`/api/v1/orders/${orderId}/logs`);
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

    // ─── Users Management (admin only) ────────────────────────
    async getUsers() {
        return this.request<{ data: any[] }>('/api/v1/users');
    }

    async createUser(data: { email: string; password: string; fullName: string; phone?: string; role: string; brandId?: string; sendInvite?: boolean }) {
        return this.request<{ data: any }>('/api/v1/users', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateUser(id: string, data: { fullName?: string; phone?: string | null; role?: string; brandId?: string | null }) {
        return this.request<{ data: any }>(`/api/v1/users/${id}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async changeUserPassword(id: string, newPassword: string) {
        return this.request<void>(`/api/v1/users/${id}/password`, {
            method: 'PATCH', body: JSON.stringify({ newPassword }),
        });
    }

    async toggleUser(id: string) {
        return this.request<{ data: any }>(`/api/v1/users/${id}/toggle`, { method: 'PATCH' });
    }

    // ─── Self password change ─────────────────────────────────
    async changeMyPassword(currentPassword: string, newPassword: string) {
        return this.request<void>('/api/v1/auth/change-password', {
            method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    async updateMyProfile(data: { fullName?: string; phone?: string | null }) {
        return this.request<{ data: any }>('/api/v1/auth/profile', {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    // ─── Forgot / Reset Password ─────────────────────────────
    async forgotPassword(email: string) {
        return this.request<{ message: string }>('/api/v1/auth/forgot-password', {
            method: 'POST', body: JSON.stringify({ email }),
        });
    }

    async resetPassword(token: string, newPassword: string) {
        return this.request<{ success: boolean; message: string }>('/api/v1/auth/reset-password', {
            method: 'POST', body: JSON.stringify({ token, newPassword }),
        });
    }

    // ─── Order Pipeline (Phase 1) ────────────────────────────
    async transitionOrder(orderId: string, targetState: string, reason?: string) {
        return this.request<{ data: any }>(`/api/v1/orders/${orderId}/transition`, {
            method: 'POST', body: JSON.stringify({ targetState, reason }),
        });
    }

    async setOrderFlags(orderId: string, flags: Record<string, boolean>) {
        return this.request<{ data: any }>(`/api/v1/orders/${orderId}/flags`, {
            method: 'POST', body: JSON.stringify({ flags }),
        });
    }

    async checkItemStock(orderId: string, itemId: string, action: 'IN_STOCK' | 'NEEDS_PURCHASE') {
        return this.request<{ data: any; createdPR?: boolean }>(`/api/v1/orders/${orderId}/items/${itemId}/check-stock`, {
            method: 'POST', body: JSON.stringify({ action }),
        });
    }

    async validateAddress(orderId: string) {
        return this.request<any>(`/api/v1/orders/${orderId}/validate-address`, {
            method: 'POST',
        });
    }

    async getMerchandise(params?: { itemState?: string; orderState?: string; brandId?: string; search?: string; includeFulfilled?: boolean; page?: number; limit?: number }) {
        const qs = new URLSearchParams();
        if (params?.itemState) qs.set('itemState', params.itemState);
        if (params?.orderState) qs.set('orderState', params.orderState);
        if (params?.brandId) qs.set('brandId', params.brandId);
        if (params?.search) qs.set('search', params.search);
        if (params?.includeFulfilled) qs.set('includeFulfilled', 'true');
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const q = qs.toString();
        return this.request<any>(`/api/v1/merchandise${q ? '?' + q : ''}`);
    }

    async checkStockAll(orderId: string) {
        return this.request<{ data: any[] }>(`/api/v1/orders/${orderId}/check-stock`);
    }

    async markItemsBulk(orderId: string, itemIds: string[], action: 'IN_STOCK' | 'NEEDS_PURCHASE') {
        return this.request<{ data: any; createdPRs?: number }>(`/api/v1/orders/${orderId}/mark-items`, {
            method: 'POST', body: JSON.stringify({ itemIds, action }),
        });
    }

    async getPipelineSummary() {
        return this.request<{ data: any }>('/api/v1/pipeline/summary');
    }

    async syncStoreOrders(storeId: string, limit = 250, sinceDate?: string) {
        let url = `/api/v1/shopify-stores/${storeId}/sync-orders?limit=${limit}`;
        if (sinceDate) url += `&sinceDate=${sinceDate}`;
        return this.request<{ data: any }>(url, {
            method: 'POST',
        });
    }

    // ─── Tasks ───────────────────────────────────────────────
    async getTasks(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/tasks${qs}`);
    }

    async getTask(id: string) {
        return this.request<{ data: any }>(`/api/v1/tasks/${id}`);
    }

    async createTask(data: { type: string; orderId: string; assigneeId?: string; notes?: string }) {
        return this.request<{ data: any }>('/api/v1/tasks', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateTaskStatus(id: string, status: string) {
        return this.request<{ data: any }>(`/api/v1/tasks/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    }

    async assignTask(id: string, assigneeId: string) {
        return this.request<{ data: any }>(`/api/v1/tasks/${id}/assign`, {
            method: 'PATCH', body: JSON.stringify({ assigneeId }),
        });
    }

    async addTaskComment(taskId: string, content: string) {
        return this.request<{ data: any }>(`/api/v1/tasks/${taskId}/comments`, {
            method: 'POST', body: JSON.stringify({ content }),
        });
    }

    async getTasksSummary() {
        return this.request<{ data: any }>('/api/v1/tasks/summary');
    }

    // ─── Procurement ─────────────────────────────────────────
    async createPR(data: { orderItemId: string; brandId: string; sku: string; qtyNeeded: number; notes?: string }) {
        return this.request<{ data: any }>('/api/v1/procurement/pr', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async getPRs(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/procurement/pr${qs}`);
    }

    async createPO(data: { brandId: string; prIds: string[]; notes?: string; currency?: string }) {
        return this.request<{ data: any }>('/api/v1/procurement/po', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async getPOs(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/procurement/po${qs}`);
    }

    async getPO(id: string) {
        return this.request<{ data: any }>(`/api/v1/procurement/po/${id}`);
    }

    async updatePRStatus(id: string, status: string) {
        return this.request<{ data: any }>(`/api/v1/procurement/pr/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    }

    async updatePOStatus(id: string, status: string) {
        return this.request<{ data: any }>(`/api/v1/procurement/po/${id}/status`, {
            method: 'PATCH', body: JSON.stringify({ status }),
        });
    }
}

export const api = new ApiClient();
