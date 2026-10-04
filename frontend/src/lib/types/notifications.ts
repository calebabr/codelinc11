// Shapes for notifications. They mirror the backend routes under /members/{id}/notifications.
export type Severity = "info" | "warning" | "success"

export interface AppNotification {
  id: number | string
  member_id: string
  kind: string
  title: string
  body: string
  severity: Severity
  link: string | null
  created_at: string
  read_at: string | null
}

export interface NotificationList {
  notifications: AppNotification[]
  unread_count: number
  app_enabled: boolean
}

export interface ReadResult {
  ok: boolean
  marked?: number
  unread_count: number
}

export type Channel = "app" | "email" | "sms"

export interface NotificationPrefs {
  app: boolean
  email: boolean
  sms: boolean
  /** null means every kind. */
  types: string[] | null
  email_on_file: boolean
  phone_on_file: boolean
}

export interface OutboxItem {
  id: number | string
  member_id: string
  channel: string
  to_address: string
  subject: string
  body: string
  created_at: string
  status: string
}

export interface TestResult {
  ok: boolean
  channel: Channel
  notification: AppNotification | null
  outbox: OutboxItem | null
}

export interface ScheduleItem {
  id: number
  member_id: string
  member_name: string
  kind: string
  due_date: string
  title: string
  note: string | null
}
