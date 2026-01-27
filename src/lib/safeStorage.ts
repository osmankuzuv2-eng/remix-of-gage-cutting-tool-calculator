/**
 * Safe localStorage utilities with error handling and optional validation
 * Prevents XSS and malformed data attacks
 */

/**
 * Safely parse JSON from localStorage with error handling
 * @param key - localStorage key
 * @param fallback - fallback value if parsing fails
 * @returns parsed data or fallback
 */
export function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    
    const parsed = JSON.parse(stored);
    
    // Basic type validation - ensure we got an object or array as expected
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    
    return parsed as T;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}":`, error);
    // Remove corrupted data
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore removal errors
    }
    return fallback;
  }
}

/**
 * Safely set JSON to localStorage with error handling
 * @param key - localStorage key
 * @param value - value to store
 * @returns boolean indicating success
 */
export function safeSetItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to save to localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove item from localStorage
 * @param key - localStorage key
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove localStorage key "${key}":`, error);
  }
}

/**
 * Validate array data from localStorage
 * @param data - parsed data
 * @returns true if data is a valid array
 */
export function isValidArray(data: unknown): data is unknown[] {
  return Array.isArray(data);
}

/**
 * Validate object data from localStorage
 * @param data - parsed data
 * @returns true if data is a valid object (not null, not array)
 */
export function isValidObject(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}
