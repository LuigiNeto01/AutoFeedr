export type JobStatus = 'pending' | 'running' | 'retry' | 'success' | 'failed'
export type AutomationKind = 'linkedin_post' | 'leetcode_commit'

export interface HealthResponse {
  status: string
  service: string
}

export interface PromptsDefaults {
  prompt_generation: string
  prompt_translation: string
}

export interface LinkedinAccount {
  id: number
  name: string
  urn: string
  prompt_generation?: string | null
  prompt_translation?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LinkedinSchedule {
  id: number
  account_id: number
  topic: string
  cron_expr: string
  day_of_week?: number | null
  time_local?: string | null
  timezone: string
  source_mode?: string | null
  objective?: string | null
  audience?: string | null
  cta_type?: string | null
  campaign_theme?: string | null
  use_date_context?: boolean | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LinkedinJob {
  id: number
  account_id: number
  source: string
  status: JobStatus
  topic?: string | null
  paper_url?: string | null
  generated_post?: string | null
  error_message?: string | null
  attempts: number
  max_attempts: number
  scheduled_for: string
  next_retry_at?: string | null
  created_at: string
  updated_at: string
}

export interface GitHubAccount {
  id: number
  name: string
  has_ssh_key: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GitHubRepository {
  id: number
  account_id: number
  repo_ssh_url: string
  default_branch: string
  solutions_dir: string
  commit_author_name: string
  commit_author_email: string
  selection_strategy: string
  difficulty_policy: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeetCodeJob {
  id: number
  repository_id: number
  schedule_id?: number | null
  source: string
  status: JobStatus
  attempts: number
  max_attempts: number
  selection_strategy?: string | null
  difficulty_policy?: string | null
  problem_frontend_id?: string | null
  problem_slug?: string | null
  problem_title?: string | null
  problem_difficulty?: string | null
  solution_path?: string | null
  tests_path?: string | null
  commit_sha?: string | null
  commit_url?: string | null
  error_message?: string | null
  scheduled_for: string
  next_retry_at?: string | null
  created_at: string
  updated_at: string
}

export interface LeetCodeJobLog {
  id: number
  job_id: number
  level: string
  message: string
  created_at: string
}

export interface LeetCodeSchedule {
  id: number
  repository_id: number
  cron_expr: string
  day_of_week?: number | null
  time_local?: string | null
  timezone: string
  selection_strategy?: string | null
  difficulty_policy?: string | null
  max_attempts: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LeetCodeCompleted {
  id: number
  repository_id: number
  job_id: number
  problem_frontend_id: string
  problem_slug: string
  problem_title: string
  problem_difficulty: string
  commit_sha: string
  created_at: string
}

export interface UnifiedExecution {
  source: AutomationKind
  status: JobStatus
  id: number
  ownerId: number
  ownerLabel: string
  title: string
  attempts: number
  maxAttempts: number
  scheduledFor: string
  createdAt: string
  updatedAt: string
  errorMessage?: string | null
  commitSha?: string | null
  commitUrl?: string | null
  generatedPost?: string | null
}
