/**
 * Browser shim for node-fetch
 *
 * @tensorflow-models/coco-ssd imports node-fetch for its HTTP client.
 * In the browser environment, we redirect to the native fetch API.
 *
 * Note: This shim is only needed during Vite bundling for browser.
 * Bun runtime has native fetch, but the browser bundle needs this redirect.
 */

// Export native fetch as default
export default fetch;

// Re-export native globals for node-fetch API compatibility
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
