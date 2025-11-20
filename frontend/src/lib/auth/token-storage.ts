/**
 * Auth Token Storage for Service Worker Access
 * 
 * Service Workers cannot access localStorage, so we need to sync
 * auth tokens to IndexedDB for SW to inject into API requests.
 */

const AUTH_DB_NAME = 'm3w-auth';
const AUTH_STORE_NAME = 'tokens';
const DB_VERSION = 1;

/**
 * Open IndexedDB connection
 */
function openAuthDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTH_DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(AUTH_STORE_NAME)) {
        db.createObjectStore(AUTH_STORE_NAME);
      }
    };
  });
}

/**
 * Save access token to IndexedDB for Service Worker access
 */
export async function saveTokenToIndexedDB(accessToken: string): Promise<void> {
  try {
    const db = await openAuthDB();
    const transaction = db.transaction([AUTH_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(AUTH_STORE_NAME);
    
    store.put(accessToken, 'accessToken');
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[Auth] Failed to save token to IndexedDB:', error);
    throw error;
  }
}

/**
 * Clear token from IndexedDB (on logout)
 */
export async function clearTokenFromIndexedDB(): Promise<void> {
  try {
    const db = await openAuthDB();
    const transaction = db.transaction([AUTH_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(AUTH_STORE_NAME);
    
    store.delete('accessToken');
    
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('[Auth] Failed to clear token from IndexedDB:', error);
    throw error;
  }
}

/**
 * Get token from IndexedDB (for testing/debugging)
 */
export async function getTokenFromIndexedDB(): Promise<string | null> {
  try {
    const db = await openAuthDB();
    const transaction = db.transaction([AUTH_STORE_NAME], 'readonly');
    const store = transaction.objectStore(AUTH_STORE_NAME);
    const request = store.get('accessToken');
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[Auth] Failed to get token from IndexedDB:', error);
    return null;
  }
}
