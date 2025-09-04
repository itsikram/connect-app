# API Configuration

This directory contains the axios API setup for the React Native app.

## Files

- `api.js` - Main axios configuration with interceptors and API services
- `config.js` - Environment-specific configuration
- `../utils/apiUtils.js` - Utility functions for API operations

## Setup

### 1. Environment Configuration

Update the API URLs in `config.js` for your different environments:

```javascript
const ENV = {
  development: {
    API_BASE_URL: 'http://localhost:3000/api',
    API_TIMEOUT: 10000,
  },
  staging: {
    API_BASE_URL: 'https://staging-api.yourapp.com/api',
    API_TIMEOUT: 15000,
  },
  production: {
    API_BASE_URL: 'https://api.yourapp.com/api',
    API_TIMEOUT: 20000,
  },
};
```

### 2. Using API Services

#### Authentication API

```javascript
import { authAPI } from '../lib/api';

// Login
const result = await authAPI.login(email, password);
if (result.success) {
  // Handle successful login
} else {
  // Handle error
  console.error(result.error);
}

// Register
const result = await authAPI.signup(userData);

// Logout
await authAPI.logout();
```

#### User API

```javascript
import { userAPI } from '../lib/api';

// Get user profile
const profile = await userAPI.getProfile(profileId);

// Update profile
await userAPI.updateProfile(userData);

// Change password
await userAPI.changePassword(passwordData);
```

#### Generic API Methods

```javascript
import { apiService } from '../lib/api';

// GET request
const data = await apiService.get('/users');

// POST request
const response = await apiService.post('/users', userData);

// PUT request
await apiService.put('/users/123', updatedData);

// DELETE request
await apiService.delete('/users/123');

// PATCH request
await apiService.patch('/users/123', partialData);
```

### 3. Error Handling

The API configuration includes automatic error handling:

- **401 Unauthorized**: Automatically clears stored auth data
- **Network errors**: Logged and can be handled in your components
- **Request timeouts**: Configurable per environment

### 4. Authentication

The axios instance automatically includes the auth token in requests:

```javascript
// Token is automatically added to requests
const response = await apiService.get('/protected-endpoint');
```

### 5. Using API Utilities

```javascript
import { createApiResponse, createApiError, formatApiError } from '../utils/apiUtils';

// Create standardized responses
const successResponse = createApiResponse(data, 'Operation successful');
const errorResponse = createApiError(error, 'Custom error message');

// Format errors
const formattedError = formatApiError(error);
```

### 6. Adding New API Endpoints

To add new API endpoints, update the API services in `api.js`:

```javascript
export const newAPI = {
  getItems: () => api.get('/items'),
  createItem: (itemData) => api.post('/items', itemData),
  updateItem: (id, itemData) => api.put(`/items/${id}`, itemData),
  deleteItem: (id) => api.delete(`/items/${id}`),
};
```

### 7. Testing

For testing, you can mock the API responses:

```javascript
// In your test files
jest.mock('../lib/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  },
  userAPI: {
    getProfile: jest.fn(),
  },
}));
```

## Best Practices

1. **Always handle errors**: Use try-catch blocks when calling API methods
2. **Use the provided services**: Don't make direct axios calls, use the configured services
3. **Update environment configs**: Make sure to update URLs for different environments
4. **Handle loading states**: Use the isLoading state from AuthContext for better UX
5. **Validate responses**: Use the utility functions to validate API responses

## Troubleshooting

### Common Issues

1. **Network errors**: Check if your API server is running and accessible
2. **CORS issues**: Ensure your backend allows requests from your app
3. **Authentication errors**: Verify that tokens are being stored and sent correctly
4. **Timeout errors**: Adjust timeout values in config.js if needed

### Debugging

Enable axios request/response logging in development:

```javascript
// Add to api.js for debugging
if (__DEV__) {
  api.interceptors.request.use(request => {
    console.log('Request:', request);
    return request;
  });
  
  api.interceptors.response.use(response => {
    console.log('Response:', response);
    return response;
  });
}
``` 