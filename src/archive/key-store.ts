const DATABASE = 'bubackov-vault';
const STORE = 'keys';
const ACTIVE_KEY = 'active-archive-key';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function rememberKey(key: CryptoKey): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(key, ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadRememberedKey(): Promise<CryptoKey | null> {
  const database = await openDatabase();
  const result = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(ACTIVE_KEY);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return result ?? null;
}

export async function forgetKey(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(ACTIVE_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
