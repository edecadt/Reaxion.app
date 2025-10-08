export function setAuthToken(token: string) {
  localStorage.setItem("token", token);

  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure=${window.location.protocol === "https:"}`;
}

export function setUser(user: {
  id: number;
  email: string;
  name?: string | null;
}) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

export function getUser(): {
  id: number;
  email: string;
  name?: string | null;
} | null {
  const userStr = localStorage.getItem("user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}
