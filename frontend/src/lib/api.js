import { clearAccessToken, getAccessToken } from "./session";

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "API error");
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_KEY = "autofeedr_api_base";

function resolveApiBase() {
  const fromStorage =
    typeof window !== "undefined"
      ? window.localStorage.getItem(API_BASE_KEY)?.trim()
      : "";
  const envBase = import.meta.env.VITE_API_BASE?.trim();
  const fallback = `${window.location.protocol}//${window.location.hostname}:8000`;
  const selected = fromStorage || envBase;

  if (!selected) return fallback;

  try {
    const parsed = new URL(selected);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return fallback;
  }
}

export const API_BASE = resolveApiBase();

async function request(path, init) {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : payload?.detail ?? `HTTP ${response.status}`;
    throw new ApiError(response.status, detail);
  }

  return payload;
}

export const api = {
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  me: () => request("/auth/me"),
  openaiKeyStatus: () => request("/auth/openai-key"),
  setOpenaiKey: (payload) =>
    request("/auth/openai-key", { method: "PUT", body: JSON.stringify(payload) }),
  prompts: () => request("/prompts/defaults"),
  leetcodePrompts: () => request("/leetcode/prompts"),
  updateLeetcodePrompts: (payload) =>
    request("/leetcode/prompts", { method: "PUT", body: JSON.stringify(payload) }),
  health: () => request("/health"),
  linkedinJobs: async (limit = 120) => {
    try {
      return await request(`/linkedin/jobs?limit=${limit}`);
    } catch {
      return request(`/jobs?limit=${limit}`);
    }
  },
  linkedinSchedules: async () => {
    try {
      return await request("/linkedin/schedules");
    } catch {
      return request("/schedules");
    }
  },
  leetcodeJobs: (params) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.repository_id) search.set("repository_id", String(params.repository_id));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request(`/leetcode/jobs${suffix}`);
  },
  leetcodeSchedules: () => request("/leetcode/schedules"),
  createLinkedinSchedule: async (payload) => {
    try {
      return await request("/linkedin/schedules", { method: "POST", body: JSON.stringify(payload) });
    } catch {
      return request("/schedules", { method: "POST", body: JSON.stringify(payload) });
    }
  },
  updateLinkedinSchedule: async (id, payload) => {
    try {
      return await request(`/linkedin/schedules/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } catch {
      return request(`/schedules/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    }
  },
  createLeetcodeSchedule: (payload) =>
    request("/leetcode/schedules", { method: "POST", body: JSON.stringify(payload) }),
  updateLeetcodeSchedule: (id, payload) =>
    request(`/leetcode/schedules/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  runLinkedinNow: async (payload) => {
    try {
      return await request("/linkedin/jobs/run-now", { method: "POST", body: JSON.stringify(payload) });
    } catch {
      return request("/jobs/publish-now", { method: "POST", body: JSON.stringify(payload) });
    }
  },
  runLeetcodeNow: (payload) =>
    request("/leetcode/jobs/run-now", { method: "POST", body: JSON.stringify(payload) }),
  linkedinAccounts: () => request("/accounts"),
  createLinkedinAccount: (payload) =>
    request("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateLinkedinAccount: (id, payload) =>
    request(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLinkedinAccount: (id) => request(`/accounts/${id}`, { method: "DELETE" }),
  githubAccounts: () => request("/github/accounts"),
  createGithubAccount: (payload) =>
    request("/github/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateGithubAccount: (id, payload) =>
    request(`/github/accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGithubAccount: (id) => request(`/github/accounts/${id}`, { method: "DELETE" }),
  githubRepositories: () => request("/github/repositories"),
  createGithubRepository: (payload) =>
    request("/github/repositories", { method: "POST", body: JSON.stringify(payload) }),
  updateGithubRepository: (id, payload) =>
    request(`/github/repositories/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGithubRepository: (id) => request(`/github/repositories/${id}`, { method: "DELETE" }),
  logout: async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      clearAccessToken();
    }
  },
};
