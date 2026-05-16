const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5000';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Request failed');
    return data as T;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, token?: string) =>
    request<T>('GET', path, undefined, token),
  post: <T>(path: string, body: unknown, token?: string) =>
    request<T>('POST', path, body, token),
  patch: <T>(path: string, body: unknown, token?: string) =>
    request<T>('PATCH', path, body, token),
  delete: <T>(path: string, token?: string) =>
    request<T>('DELETE', path, undefined, token),
};

export async function uploadFile(
  path: string,
  fileUri: string,
  token: string,
): Promise<{ url: string }> {
  const filename = fileUri.split('/').pop() ?? 'upload';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri: fileUri, name: filename, type } as any);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data;
}
