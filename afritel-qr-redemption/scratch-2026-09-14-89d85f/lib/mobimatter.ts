import axios, { AxiosError } from 'axios';
import { retryWithBackoff } from './retryLogic';

interface MobimatterProduct {
  productId: string;
  name: string;
  description?: string;
  price?: number;
  validity?: string;
  dataAmount?: string;
  destination?: string;
}

interface MobimatterOrderResponse {
  orderId: string;
  orderLineItem?: {
    lineItemDetails: Array<{
      name: string;
      value: string;
    }>;
  };
  result?: {
    orderLineItem: {
      lineItemDetails: Array<{
        name: string;
        value: string;
      }>;
    };
  };
  message?: string;
  error?: string;
}

interface MobimatterOrderCompleteResponse {
  orderId: string;
  status: string;
  orderLineItem?: {
    lineItemDetails: Array<{
      name: string;
      value: string;
    }>;
  };
  result?: {
    orderLineItem: {
      lineItemDetails: Array<{
        name: string;
        value: string;
      }>;
    };
  };
  message?: string;
}

const client = axios.create({
  baseURL: process.env.MOBIMATTER_API_BASE_URL || 'https://api-sandbox.mobimatter.com/mobimatter/api/v2/',
  headers: {
    'api-key': process.env.MOBIMATTER_API_KEY,
    'merchantId': process.env.MOBIMATTER_MERCHANT_ID,
    'Content-Type': 'application/json',
  },
});

export const MobimatterAPI = {
  /**
   * Fetch products catalog from Mobimatter
   */
  async getProducts(): Promise<MobimatterProduct[]> {
    try {
      const response = await client.get('/products');
      return response.data || [];
    } catch (error) {
      console.error('Mobimatter getProducts error:', error);
      throw error;
    }
  },

  /**
   * Create an order for a given product
   * Returns orderId which must be completed within ~20 minutes
   * Retries on transient failures (429, 455)
   */
  async createOrder(productId: string, retryAttempts: number = 3): Promise<string> {
    try {
      const response = await retryWithBackoff(
        () => client.post('/order', { productId }),
        { maxAttempts: retryAttempts }
      );
      const orderId = response.data?.orderId || response.data?.order?.orderId;
      if (!orderId) {
        throw new Error('No orderId returned from Mobimatter');
      }
      return orderId;
    } catch (error: any) {
      const status = error.response?.status || error.statusCode || 500;
      const statusText = this.getErrorMessage(status);
      throw new Error(`Failed to create order: ${statusText}`);
    }
  },

  /**
   * Complete an order to receive the real eSIM QR code and LPA
   * Retries on transient failures (429, 455)
   */
  async completeOrder(orderId: string, retryAttempts: number = 3): Promise<MobimatterOrderCompleteResponse> {
    try {
      const response = await retryWithBackoff(
        () => client.put('/order/complete', { orderId }),
        { maxAttempts: retryAttempts }
      );
      return response.data;
    } catch (error: any) {
      const status = error.response?.status || error.statusCode || 500;
      const statusText = this.getErrorMessage(status);
      throw new Error(`Failed to complete order: ${statusText}`);
    }
  },

  /**
   * Extract specific line item detail from Mobimatter response
   */
  extractLineItemDetail(response: MobimatterOrderCompleteResponse, name: string): string | null {
    const lineItems = response.result?.orderLineItem?.lineItemDetails ||
                      response.orderLineItem?.lineItemDetails ||
                      [];
    const item = lineItems.find((li) => li.name === name);
    return item?.value || null;
  },

  /**
   * Get human-readable error message for HTTP status code
   */
  getErrorMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Invalid request (400)';
      case 402:
        return 'Insufficient wallet balance (402)';
      case 404:
        return 'Resource not found (404)';
      case 429:
        return 'Product out of stock (429)';
      case 455:
        return 'Provider temporarily unavailable (455)';
      case 503:
        return 'Service unavailable (503)';
      case 504:
        return 'Gateway timeout (504)';
      default:
        return `API error (${status})`;
    }
  },
};
