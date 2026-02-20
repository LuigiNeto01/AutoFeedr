import type {
  AuthLoginResponse,
  AuthUser,
  GitHubAccount,
  GitHubRepository,
  HealthResponse,
  LeetCodeCompleted,
  LeetCodeJob,
  LeetCodeJobLog,
  LeetCodePromptSettings,
  LeetCodeSchedule,
  LinkedinAccount,
  LinkedinJob,
  LinkedinSchedule,
  PromptsDefaults,
} from '@/entities/types'
import { clearAccessToken, getAccessToken } from '@/shared/lib/session'

export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

const API_BASE_KEY = 'autofeedr_api_base'

function resolveApiBase() {
  const fromStorage =
    typeof window !== 'undefined' ? window.localStorage.getItem(API_BASE_KEY)?.trim() : ''
  const envBase = import.meta.env.VITE_API_BASE?.trim()
  const fallback = `${window.location.protocol}//${window.location.hostname}:8000`
  const selected = fromStorage || envBase
  if (!selected) return fallback

  try {
    const parsed = new URL(selected)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return fallback
  }
}

export function setApiBase(base: string) {
  const normalized = base.trim()
  if (!normalized) {
    window.localStorage.removeItem(API_BASE_KEY)
    return
  }
  window.localStorage.setItem(API_BASE_KEY, normalized)
}

export const API_BASE = resolveApiBase()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const isJson = response.headers.get('content-type')?.includes('application/json')
  const payload = isJson ? await response.json().catch(() => null) : await response.text()

  if (!response.ok) {
    const detail =
      typeof payload === 'string'
        ? payload
        : payload?.detail || JSON.stringify(payload) || `HTTP ${response.status}`
    throw new ApiError(response.status, detail)
  }

  return payload as T
}

export const api = {
  register: (payload: { email: string; password: string }) =>
    request<AuthLoginResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    request<AuthLoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => request<AuthUser>('/auth/me'),
  logout: async () => {
    try {
      await request<{ ok: boolean }>('/auth/logout', { method: 'POST' })
    } finally {
      clearAccessToken()
    }
  },

  health: () => request<HealthResponse>('/health'),
  prompts: () => request<PromptsDefaults>('/prompts/defaults'),

  linkedinAccounts: () => request<LinkedinAccount[]>('/accounts'),
  createLinkedinAccount: (payload: unknown) =>
    request<LinkedinAccount>('/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  updateLinkedinAccount: (id: number, payload: unknown) =>
    request<LinkedinAccount>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLinkedinAccount: (id: number) =>
    request<{ ok: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),

  linkedinSchedules: () => request<LinkedinSchedule[]>('/schedules'),
  createLinkedinSchedule: (payload: unknown) =>
    request<LinkedinSchedule>('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
  updateLinkedinSchedule: (id: number, payload: unknown) =>
    request<LinkedinSchedule>(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  runLinkedinNow: (payload: unknown) =>
    request<LinkedinJob>('/jobs/publish-now', { method: 'POST', body: JSON.stringify(payload) }),
  linkedinJobs: (limit = 50) => request<LinkedinJob[]>(`/jobs?limit=${limit}`),

  githubAccounts: () => request<GitHubAccount[]>('/github/accounts'),
  createGithubAccount: (payload: unknown) =>
    request<GitHubAccount>('/github/accounts', { method: 'POST', body: JSON.stringify(payload) }),
  updateGithubAccount: (id: number, payload: unknown) =>
    request<GitHubAccount>(`/github/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteGithubAccount: (id: number) =>
    request<{ ok: boolean }>(`/github/accounts/${id}`, { method: 'DELETE' }),

  githubRepositories: () => request<GitHubRepository[]>('/github/repositories'),
  createGithubRepository: (payload: unknown) =>
    request<GitHubRepository>('/github/repositories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateGithubRepository: (id: number, payload: unknown) =>
    request<GitHubRepository>(`/github/repositories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteGithubRepository: (id: number) =>
    request<{ ok: boolean }>(`/github/repositories/${id}`, { method: 'DELETE' }),

  runLeetcodeNow: (payload: unknown) =>
    request<LeetCodeJob>('/leetcode/jobs/run-now', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  leetcodeJobs: (params?: { limit?: number; repository_id?: number }) => {
    const search = new URLSearchParams()
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.repository_id) search.set('repository_id', String(params.repository_id))
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request<LeetCodeJob[]>(`/leetcode/jobs${suffix}`)
  },
  leetcodeJob: (id: number) => request<LeetCodeJob>(`/leetcode/jobs/${id}`),
  leetcodeLogs: (id: number, limit = 100) =>
    request<LeetCodeJobLog[]>(`/leetcode/jobs/${id}/logs?limit=${limit}`),

  leetcodeSchedules: () => request<LeetCodeSchedule[]>('/leetcode/schedules'),
  createLeetcodeSchedule: (payload: unknown) =>
    request<LeetCodeSchedule>('/leetcode/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLeetcodeSchedule: (id: number, payload: unknown) =>
    request<LeetCodeSchedule>(`/leetcode/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  leetcodeCompleted: (params?: { repository_id?: number; limit?: number }) => {
    const search = new URLSearchParams()
    if (params?.repository_id) search.set('repository_id', String(params.repository_id))
    if (params?.limit) search.set('limit', String(params.limit))
    const suffix = search.toString() ? `?${search.toString()}` : ''
    return request<LeetCodeCompleted[]>(`/leetcode/completed${suffix}`)
  },
  leetcodePrompts: () => request<LeetCodePromptSettings>('/leetcode/prompts'),
  updateLeetcodePrompts: (payload: LeetCodePromptSettings) =>
    request<LeetCodePromptSettings>('/leetcode/prompts', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
}
