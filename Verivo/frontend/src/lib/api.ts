export class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(`API Error ${status}`);
  }
}

// Fonction generique pour tous les appels API
// Le <T> (generique) permet de typer la reponse : api.get<User>("/api/auth/me")
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  // Recupere le JWT depuis localStorage (null si pas connecte)
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("verivo_token")
      : null;

  // Headers par defaut : JSON + JWT si present
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Appel HTTP
  const response = await fetch(path, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  // Si erreur HTTP, on lance une ApiError avec le corps de la reponse
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Erreur inconnue" }));
    throw new ApiError(response.status, errorData);
  }

  return response.json();
}

// Methodes raccourcies exportees
export const api = {
  get: <T>(path: string) => fetchApi<T>(path),

  post: <T>(path: string, body: unknown) =>
    fetchApi<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};