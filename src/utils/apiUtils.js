// API utility functions

/**
 * Format API error response
 * @param {Error} error - The error object from axios
 * @returns {Object} Formatted error object
 */
export const formatApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    return {
      status,
      message: data?.message || `HTTP ${status} error`,
      data: data,
      isNetworkError: false,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      status: 0,
      message: 'Network error - no response received',
      data: null,
      isNetworkError: true,
    };
  } else {
    // Something else happened
    return {
      status: 0,
      message: error.message || 'Unknown error occurred',
      data: null,
      isNetworkError: false,
    };
  }
};

/**
 * Create a standardized API response
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Standardized response
 */
export const createApiResponse = (data, message = 'Success') => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Create a standardized API error response
 * @param {Error} error - Error object
 * @param {string} defaultMessage - Default error message
 * @returns {Object} Standardized error response
 */
export const createApiError = (error, defaultMessage = 'An error occurred') => {
  const formattedError = formatApiError(error);
  return {
    success: false,
    error: formattedError,
    message: formattedError.message || defaultMessage,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Validate API response
 * @param {Object} response - API response
 * @returns {boolean} Whether response is valid
 */
export const isValidResponse = (response) => {
  return response && 
         response.data && 
         typeof response.data === 'object' &&
         response.status >= 200 && 
         response.status < 300;
};

/**
 * Extract data from API response
 * @param {Object} response - API response
 * @returns {*} Extracted data
 */
export const extractData = (response) => {
  if (isValidResponse(response)) {
    return response.data;
  }
  throw new Error('Invalid API response');
};

/**
 * Create request headers
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Request headers
 */
export const createHeaders = (additionalHeaders = {}) => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...additionalHeaders,
  };
};

/**
 * Create request config
 * @param {Object} options - Request options
 * @returns {Object} Request configuration
 */
export const createRequestConfig = (options = {}) => {
  const {
    headers = {},
    timeout,
    params,
    ...otherOptions
  } = options;

  return {
    headers: createHeaders(headers),
    timeout,
    params,
    ...otherOptions,
  };
}; 