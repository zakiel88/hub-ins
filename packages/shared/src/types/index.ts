/**
 * Standard API response wrappers.
 */
export interface ApiResponse<T> {
    data: T;
    meta: {
        timestamp: string;
        page?: number;
        limit?: number;
        total?: number;
    };
}

export interface ApiError {
    error: {
        code: string;
        message: string;
        details?: unknown[];
    };
}

export interface PaginationParams {
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}
