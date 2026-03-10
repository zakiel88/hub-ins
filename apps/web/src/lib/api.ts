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
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const headers: Record<string, string> = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

    async getBrandsSummary() {
        return this.request<{ total: number; active: number; processing: number; pending: number; inactive: number }>(`/api/v1/brands/summary`);
    }

    async getBanks() {
        return this.request<{ id: string; fullName: string; brandName: string; swiftCode: string | null }[]>(`/api/v1/brands/banks`);
    }

    async uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        const token = this.getToken();
        const res = await fetch(`${API_BASE}/api/v1/uploads`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
        return res.json() as Promise<{ url: string; filename: string; size: number; mimetype: string }>;
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

    // Products v2
    async getProducts(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/products${qs}`);
    }

    async getProductsSummary() {
        return this.request<any>(`/api/v1/products/summary`);
    }

    async getProduct(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/${id}`);
    }

    async updateProduct(id: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/products/${id}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async archiveProduct(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/${id}/archive`, {
            method: 'PATCH',
        });
    }

    // Product Variants
    async getProductVariants(productId: string, params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/products/${productId}/variants${qs}`);
    }

    async updateVariant(productId: string, variantId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/variants/${variantId}`, {
            method: 'PUT', body: JSON.stringify(data),
        });
    }

    async bulkUpdateVariants(productId: string, updates: any[]) {
        return this.request<{ data: any[]; updated: number }>(`/api/v1/products/${productId}/variants/bulk`, {
            method: 'PATCH', body: JSON.stringify({ updates }),
        });
    }

    async getVariants(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/product-variants${qs}`);
    }

    async getVariantBySku(sku: string) {
        return this.request<{ data: any }>(`/api/v1/product-variants/by-sku/${encodeURIComponent(sku)}`);
    }

    // Sync Jobs
    async getSyncJobs(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/products/sync-jobs${qs}`);
    }

    async getSyncJob(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/sync-jobs/${id}`);
    }

    // Product Issues
    async getProductIssues(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/products/issues${qs}`);
    }

    async resolveIssue(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/issues/${id}/resolve`, { method: 'PATCH' });
    }

    async ignoreIssue(id: string) {
        return this.request<{ data: any }>(`/api/v1/products/issues/${id}/ignore`, { method: 'PATCH' });
    }

    async runAllRules() {
        return this.request<any>(`/api/v1/products/rules/run-all`, { method: 'PATCH' });
    }

    // Shopify Stores & Sync
    async getShopifyStores(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/shopify-stores${qs}`);
    }

    async syncProductsFromStore(storeId: string) {
        return this.request<{ data: { jobId: string }; message: string }>(`/api/v1/sync/import/${storeId}`, { method: 'POST' });
    }

    async getSyncJobStatus(jobId: string) {
        return this.request<{ data: any }>(`/api/v1/products/sync-jobs/${jobId}`);
    }

    // Intake Import
    async previewIntake(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request<any>(`/api/v1/products/import/preview`, {
            method: 'POST',
            body: formData,
            headers: {}, // let browser set Content-Type with boundary
        });
    }

    async commitIntake(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        return this.request<any>(`/api/v1/products/import/commit`, {
            method: 'POST',
            body: formData,
            headers: {},
        });
    }

    // Global Bulk Variant Operations
    async globalBulkUpdateVariants(action: string, variantIds: string[], data?: any) {
        return this.request<any>(`/api/v1/product-variants/bulk`, {
            method: 'PATCH',
            body: JSON.stringify({ action, variantIds, data }),
        });
    }


    // Variant Groups
    async getVariantGroups(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/variant-groups${qs}`);
    }

    // Manual Create
    async getNextStyleCode(brandId?: string) {
        const qs = brandId ? `?brandId=${brandId}` : '';
        return this.request<{ data: { styleCode: string; prefix: string; sequence: number } }>(`/api/v1/products/next-style-code${qs}`);
    }

    async createProduct(data: any) {
        return this.request<{ data: any }>('/api/v1/products', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async createSku(productId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/skus`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async createVariantGroup(productId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/variant-groups`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async addSizeToGroup(groupId: string, data: any) {
        return this.request<{ data: any }>(`/api/v1/variant-groups/${groupId}/sizes`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async removeSizeFromGroup(groupId: string, size: string) {
        return this.request<{ data: any }>(`/api/v1/variant-groups/${groupId}/sizes/${encodeURIComponent(size)}`, {
            method: 'DELETE',
        });
    }

    // Shopify Draft Listing
    async listToShopify(productId: string, storeId: string) {
        return this.request<any>(`/api/v1/products/${productId}/list-to-shopify`, {
            method: 'POST',
            body: JSON.stringify({ storeId }),
        });
    }

    async bulkListToShopify(productIds: string[], storeId: string) {
        return this.request<any>(`/api/v1/products/list-to-shopify/bulk`, {
            method: 'POST',
            body: JSON.stringify({ productIds, storeId }),
        });
    }

    // Sync
    async triggerImport(storeId: string) {
        return this.request<{ data: { jobId: string }; message: string }>(`/api/v1/sync/import/${storeId}`, {
            method: 'POST',
        });
    }

    async triggerMetafields(storeId: string) {
        return this.request<{ data: { jobId: string }; message: string }>(`/api/v1/sync/metafields/${storeId}`, {
            method: 'POST',
        });
    }

    // Jobs
    async getJobs(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/jobs${qs}`);
    }

    async getJob(id: string) {
        return this.request<{ data: any }>(`/api/v1/jobs/${id}`);
    }

    async getJobsSummary() {
        return this.request<any>(`/api/v1/jobs/summary`);
    }

    async retryJob(id: string) {
        return this.request<{ data: any }>(`/api/v1/jobs/${id}/retry`, { method: 'POST' });
    }

    async cancelJob(id: string) {
        return this.request<{ data: any }>(`/api/v1/jobs/${id}/cancel`, { method: 'PATCH' });
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

    async getMerchandise(params?: { itemState?: string; orderState?: string; brandId?: string; storeId?: string; search?: string; includeFulfilled?: boolean; page?: number; limit?: number }) {
        const qs = new URLSearchParams();
        if (params?.itemState) qs.set('itemState', params.itemState);
        if (params?.orderState) qs.set('orderState', params.orderState);
        if (params?.brandId) qs.set('brandId', params.brandId);
        if (params?.storeId) qs.set('storeId', params.storeId);
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

    async updateMerchandiseItemState(itemId: string, itemState: string) {
        return this.request<{ data: any }>(`/api/v1/merchandise/${itemId}/state`, {
            method: 'PATCH',
            body: JSON.stringify({ itemState }),
            headers: { 'Content-Type': 'application/json' },
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

    // ═══════════════════════════════════════
    // Sprint 2: Metafields
    // ═══════════════════════════════════════

    // Definitions
    async getMetafieldDefinitions(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[] }>(`/api/v1/metafields/definitions${qs}`);
    }

    async createMetafieldDefinition(data: { namespace?: string; key: string; type: string; ownerType: string; label?: string; description?: string; validationJson?: any }) {
        return this.request<{ data: any }>('/api/v1/metafields/definitions', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateMetafieldDefinition(id: string, data: { label?: string; description?: string; validationJson?: any; isActive?: boolean; isRequired?: boolean }) {
        return this.request<{ data: any }>(`/api/v1/metafields/definitions/${id}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    }

    // Options Library
    async getDefinitionsWithOptions(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[] }>(`/api/v1/metafields/definitions-with-options${qs}`);
    }

    async addMetafieldOption(definitionId: string, value: string, label?: string) {
        return this.request<{ data: any }>(`/api/v1/metafields/definitions/${definitionId}/options`, {
            method: 'POST', body: JSON.stringify({ value, label }),
        });
    }

    async removeMetafieldOption(optionId: string) {
        return this.request<any>(`/api/v1/metafields/options/${optionId}`, { method: 'DELETE' });
    }

    async bulkAddMetafieldOptions(definitionId: string, values: string[]) {
        return this.request<{ data: any }>(`/api/v1/metafields/definitions/${definitionId}/options/bulk`, {
            method: 'POST', body: JSON.stringify({ values }),
        });
    }

    async autoPopulateMetafieldOptions(definitionId: string) {
        return this.request<{ data: any }>(`/api/v1/metafields/definitions/${definitionId}/options/auto-populate`, {
            method: 'POST',
        });
    }

    // Catalog Schema
    async getCatalogSchema(categoryId: string) {
        return this.request<{ data: any[] }>(`/api/v1/metafields/schemas?categoryId=${categoryId}`);
    }

    async addCatalogSchema(data: { shopifyCategoryId: string; definitionId: string; isRequired?: boolean; displayOrder?: number }) {
        return this.request<{ data: any }>('/api/v1/metafields/schemas', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateCatalogSchema(id: string, data: { isRequired?: boolean; displayOrder?: number }) {
        return this.request<{ data: any }>(`/api/v1/metafields/schemas/${id}`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    }

    async removeCatalogSchema(id: string) {
        return this.request<any>(`/api/v1/metafields/schemas/${id}`, { method: 'DELETE' });
    }

    // Values
    async getAllMetafieldValues(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/metafields/values/all${qs}`);
    }

    async getMetafieldValues(ownerType: string, ownerId: string, storeId?: string) {
        const qs = new URLSearchParams({ ownerType, ownerId });
        if (storeId) qs.set('storeId', storeId);
        return this.request<{ data: any[] }>(`/api/v1/metafields/values?${qs}`);
    }

    async upsertMetafieldValue(data: { ownerType: string; ownerId: string; definitionId: string; storeId?: string; valueJson: any }) {
        return this.request<{ data: any }>('/api/v1/metafields/values', {
            method: 'POST', body: JSON.stringify(data),
        });
    }

    async updateMetafieldValue(id: string, valueJson: any) {
        return this.request<{ data: any }>(`/api/v1/metafields/values/${id}`, {
            method: 'PATCH', body: JSON.stringify({ valueJson }),
        });
    }

    // Approval
    async submitMetafieldsForReview(valueIds: string[]) {
        return this.request<any>('/api/v1/metafields/values/submit', {
            method: 'POST', body: JSON.stringify({ valueIds }),
        });
    }

    async getApprovalQueue(params?: Record<string, string>) {
        const qs = params ? '?' + new URLSearchParams(params).toString() : '';
        return this.request<{ data: any[]; meta: any }>(`/api/v1/metafields/approval-queue${qs}`);
    }

    async approveMetafield(valueId: string) {
        return this.request<any>('/api/v1/metafields/approve', {
            method: 'POST', body: JSON.stringify({ valueId }),
        });
    }

    async bulkApproveMetafields(valueIds: string[]) {
        return this.request<any>('/api/v1/metafields/approve', {
            method: 'POST', body: JSON.stringify({ valueIds }),
        });
    }

    async rejectMetafield(valueId: string, reason: string) {
        return this.request<any>('/api/v1/metafields/reject', {
            method: 'POST', body: JSON.stringify({ valueId, reason }),
        });
    }

    async getMetafieldsPendingCount() {
        return this.request<{ count: number }>('/api/v1/metafields/pending-count');
    }

    // Validation (Sprint 2.1: per-store)
    async getProductValidation(productId: string) {
        return this.request<{
            global: { isValid: boolean; missingRequired: any[] } | null;
            stores: { storeId: string; storeName: string; isValid: boolean; missingRequired: any[] }[];
        }>(`/api/v1/metafields/validate/${productId}`);
    }

    async revalidateProduct(productId: string) {
        return this.request<{ data: any[]; message: string }>(`/api/v1/metafields/revalidate/${productId}`, {
            method: 'POST',
        });
    }

    // Taxonomy
    async searchTaxonomy(q?: string) {
        const qs = q ? `?q=${encodeURIComponent(q)}` : '';
        return this.request<{ data: any[] }>(`/api/v1/metafields/taxonomy${qs}`);
    }

    // Push (Sprint 2.1: scoped push)
    async triggerMetafieldsPush(params?: {
        storeIds?: string[]; productIds?: string[]; brandIds?: string[];
        categoryIds?: string[]; force?: boolean;
        storeId?: string; ownerType?: string; ownerId?: string; // legacy
    }) {
        return this.request<{ data: { jobId: string }; message: string }>('/api/v1/metafields/push', {
            method: 'POST', body: JSON.stringify(params || {}),
        });
    }

    async pushProductMetafields(productId: string, storeId?: string) {
        const qs = storeId ? `?storeId=${storeId}` : '';
        return this.request<{ data: { jobId: string }; message: string }>(`/api/v1/metafields/push/product/${productId}${qs}`, {
            method: 'POST',
        });
    }

    async pushBrandMetafields(brandId: string, storeId?: string) {
        const qs = storeId ? `?storeId=${storeId}` : '';
        return this.request<{ data: { jobId: string }; message: string }>(`/api/v1/metafields/push/brand/${brandId}${qs}`, {
            method: 'POST',
        });
    }

    // Sprint 2: Product pricing & category
    async updateProductCategory(productId: string, shopifyCategoryId: string | null) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/category`, {
            method: 'PATCH', body: JSON.stringify({ shopifyCategoryId }),
        });
    }

    async updateVariantPricing(productId: string, variantId: string, data: { vendorPrice?: number; cogs?: number }) {
        return this.request<{ data: any }>(`/api/v1/products/${productId}/variants/${variantId}/pricing`, {
            method: 'PATCH', body: JSON.stringify(data),
        });
    }

    async syncMetafieldDefinitions(storeId?: string) {
        const qs = storeId ? `?storeId=${storeId}` : '';
        return this.request<{ data: any; message: string }>(`/api/v1/metafields/definitions/sync${qs}`, {
            method: 'POST',
        });
    }

    async syncMetafieldValues(storeId?: string) {
        const qs = storeId ? `?storeId=${storeId}` : '';
        return this.request<{ data: any; message: string }>(`/api/v1/metafields/values/sync${qs}`, {
            method: 'POST',
        });
    }
}


export const api = new ApiClient();
