/**
 * Standard API response utilities for consistent response format
 */

export interface ApiSuccessResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
}

export class ResponseHelper {
  /**
   * Create standardized success response
   */
  static success<T>(message: string, data: T): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * Create success response for resource creation
   */
  static created<T>(resourceName: string, data: T): ApiSuccessResponse<T> {
    return this.success(`${resourceName} created successfully`, data);
  }

  /**
   * Create success response for resource updates
   */
  static updated<T>(resourceName: string, data: T): ApiSuccessResponse<T> {
    return this.success(`${resourceName} updated successfully`, data);
  }

  /**
   * Create success response for actions
   */
  static action(
    actionName: string,
    data?: Record<string, unknown>,
  ): ApiSuccessResponse<Record<string, unknown>> {
    return this.success(`${actionName} completed successfully`, data || {});
  }

  /**
   * Create success response for resource deletion
   */
  static deleted(resourceName: string, id?: string): ApiSuccessResponse<Record<string, unknown>> {
    return this.success(`${resourceName} deleted successfully`, id ? { id } : {});
  }

  /**
   * Create success response for approval actions
   */
  static approved<T>(resourceName: string, data: T): ApiSuccessResponse<T> {
    return this.success(`${resourceName} approved successfully`, data);
  }

  /**
   * Create success response for rejection actions
   */
  static rejected<T>(resourceName: string, data: T): ApiSuccessResponse<T> {
    return this.success(`${resourceName} rejected successfully`, data);
  }
}
