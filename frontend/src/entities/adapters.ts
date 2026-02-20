import type {
  GitHubRepository,
  LinkedinAccount,
  LinkedinJob,
  LeetCodeJob,
  UnifiedExecution,
} from '@/entities/types'

export function toUnifiedLinkedinJobs(
  jobs: LinkedinJob[],
  accounts: LinkedinAccount[],
): UnifiedExecution[] {
  const accountNameById = new Map(accounts.map((item) => [item.id, item.name]))
  return jobs.map((job) => ({
    source: 'linkedin_post',
    status: job.status,
    id: job.id,
    ownerId: job.account_id,
    ownerLabel: accountNameById.get(job.account_id) ?? `Conta #${job.account_id}`,
    title: job.topic ?? 'Post manual',
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    scheduledFor: job.scheduled_for,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    errorMessage: job.error_message,
    generatedPost: job.generated_post,
  }))
}

export function toUnifiedLeetcodeJobs(
  jobs: LeetCodeJob[],
  repositories: GitHubRepository[],
): UnifiedExecution[] {
  const repoById = new Map(repositories.map((item) => [item.id, item.repo_ssh_url]))
  return jobs.map((job) => ({
    source: 'leetcode_commit',
    status: job.status,
    id: job.id,
    ownerId: job.repository_id,
    ownerLabel: repoById.get(job.repository_id) ?? `Repo #${job.repository_id}`,
    title: job.problem_title ?? job.problem_slug ?? 'Desafio LeetCode',
    attempts: job.attempts,
    maxAttempts: job.max_attempts,
    scheduledFor: job.scheduled_for,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    errorMessage: job.error_message,
    commitSha: job.commit_sha,
    commitUrl: job.commit_url,
  }))
}

export function sortByMostRecent(executions: UnifiedExecution[]) {
  return [...executions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
