export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CalculatedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  meta: PaginationMeta;
  data: T[];
}

const calculatePagination = (
  options: PaginationOptions,
  defaultSortBy = "createdAt",
): CalculatedPagination => {
  const page = Math.max(1, Number(options.page) || 1);
  const rawLimit = Number(options.limit) || 10;
  // Prevent denial of service: Clamp maximum page size to 100
  const limit = Math.min(100, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  const sortBy = options.sortBy?.trim() || defaultSortBy;
  const sortOrder = options.sortOrder === "asc" ? "asc" : "desc";

  return {
    page,
    limit,
    skip,
    take: limit,
    sortBy,
    sortOrder,
  };
};

const formatPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const PaginationUtils = {
  calculatePagination,
  formatPaginationMeta,
};
