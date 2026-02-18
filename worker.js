/**
 * Generalized CORS Proxy Cloudflare Worker
 * 
 * This worker acts as a configurable CORS proxy that can forward requests
 * to any target endpoint while adding the necessary CORS headers.
 * 
 * Features:
 * - Configurable target endpoint via environment variables
 * - Multiple allowed origins support
 * - Simple wildcard path matching with asterisk patterns
 * - Dynamic HTTP methods handling based on request headers
 * - Optional payload override for endpoints without CORS support
 * - Flexible CORS configuration
 */

/**
 * Configuration class to handle environment variables and defaults
 */
class ProxyConfig {
  constructor(env) {
    this.env = env;
    this.config = this.parseConfig();
  }

  parseConfig() {
    // Required configuration
    const targetEndpoint = this.env.TARGET_ENDPOINT;
    if (!targetEndpoint) {
      throw new Error('TARGET_ENDPOINT environment variable is required');
    }

    const allowedOrigins = this.parseJsonArray(this.env.ALLOWED_ORIGINS, []);
    if (allowedOrigins.length === 0) {
      throw new Error('ALLOWED_ORIGINS environment variable is required');
    }

    const allowedPaths = this.parseJsonArray(this.env.ALLOWED_PATHS, []);
    if (allowedPaths.length === 0) {
      throw new Error('ALLOWED_PATHS environment variable is required');
    }

    // Optional configuration with defaults
    return {
      targetEndpoint,
      allowedOrigins,
      allowedPaths,
      payloadOverride: this.env.PAYLOAD_OVERRIDE || null,
      corsMaxAge: parseInt(this.env.CORS_MAX_AGE || '86400'),
      additionalHeaders: this.parseJsonObject(this.env.ADDITIONAL_HEADERS, {}),
    };
  }

  parseJsonArray(value, defaultValue) {
    if (!value) return defaultValue;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  parseJsonObject(value, defaultValue) {
    if (!value) return defaultValue;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  get() {
    return this.config;
  }
}

/**
 * Simple wildcard path matcher
 * Supports patterns like:
 * - /api/STAR (matches /api/users, /api/posts, etc.)
 * - /auth/STAR/callback (matches /auth/google/callback, /auth/github/callback, etc.)
 * - /exact/path (exact match)
 * Note: STAR represents the asterisk wildcard character
 */
function matchesPath(requestPath, pattern) {
  // Convert wildcard pattern to regex
  const escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
    .replace(/\*/g, '[^/]*'); // Replace * with [^/]* to match any chars except /
  
  const regex = new RegExp(`^${escapedPattern}$`);
  return regex.test(requestPath);
}

/**
 * Check if the request path matches any of the allowed paths
 */
function isPathAllowed(requestPath, allowedPaths) {
  return allowedPaths.some(pattern => matchesPath(requestPath, pattern));
}

/**
 * Check if the origin is allowed
 */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

/**
 * Get the appropriate Access-Control-Allow-Origin header value
 */
function getAllowOriginHeader(requestOrigin, allowedOrigins) {
  if (isOriginAllowed(requestOrigin, allowedOrigins)) {
    return requestOrigin;
  }
  return null;
}

/**
 * Extract allowed methods from the request or use defaults
 */
function getAllowedMethods(request) {
  const requestMethod = request.headers.get('Access-Control-Request-Method');
  if (requestMethod) {
    return `GET, POST, PUT, DELETE, PATCH, OPTIONS, ${requestMethod}`.split(', ').filter((v, i, a) => a.indexOf(v) === i).join(', ');
  }
  return 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
}

/**
 * Create CORS headers based on the request and configuration
 */
function createCorsHeaders(request, config) {
  const origin = request.headers.get('Origin');
  const allowOrigin = getAllowOriginHeader(origin, config.allowedOrigins);
  
  const headers = {
    'Access-Control-Allow-Methods': getAllowedMethods(request),
    'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Requested-With',
    'Access-Control-Max-Age': config.corsMaxAge.toString(),
    'Vary': 'Origin',
  };

  // Only add Allow-Origin if the origin is allowed
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }

  // Add any additional headers from configuration
  Object.assign(headers, config.additionalHeaders);

  return headers;
}

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(request, config) {
  const corsHeaders = createCorsHeaders(request, config);
  
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle 404 responses for non-matching paths
 */
function handle404(request, config) {
  const corsHeaders = createCorsHeaders(request, config);
  
  return new Response('Not Found', {
    status: 404,
    headers: corsHeaders,
  });
}

/**
 * Forward the request to the target endpoint
 */
async function forwardRequest(request, config) {
  const url = new URL(request.url);
  const destinationUrl = config.targetEndpoint + url.search;

  // Create the forwarded request
  const forwardedRequest = new Request(destinationUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow',
  });

  try {
    // Make the request to the target endpoint
    const response = await fetch(forwardedRequest);
    
    // Get CORS headers for the response
    const corsHeaders = createCorsHeaders(request, config);
    
    // Create response headers by merging original response headers with CORS headers
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    // Handle payload override if configured
    let responseBody = response.body;
    if (config.payloadOverride !== null) {
      responseBody = config.payloadOverride;
      responseHeaders.set('Content-Type', 'text/plain');
      responseHeaders.set('Content-Length', config.payloadOverride.length.toString());
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error forwarding request to target endpoint:', error);
    
    const corsHeaders = createCorsHeaders(request, config);
    return new Response('Error proxying the request', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Main worker export
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Initialize configuration
      const proxyConfig = new ProxyConfig(env);
      const config = proxyConfig.get();

      // Parse the request URL
      const url = new URL(request.url);
      const pathName = url.pathname;

      // Check if path is allowed
      if (!isPathAllowed(pathName, config.allowedPaths)) {
        return handle404(request, config);
      }

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return handlePreflight(request, config);
      }

      // Forward the request to the target endpoint
      return await forwardRequest(request, config);

    } catch (error) {
      console.error('Worker error:', error);
      
      // Return a basic error response with minimal CORS headers
      return new Response(`Configuration Error: ${error.message}`, {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain',
        },
      });
    }
  },
};
