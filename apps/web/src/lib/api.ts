export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function postJson<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message =
      (data && data.message) || `Request failed with ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }
  return data as T;
}
