/** Shared dropdown / filter enums for resident case management (aligned with product spec + common DB values). */

export const SESSION_TYPES = ['Individual', 'Group'] as const

export const EMOTIONAL_STATES = [
  'Calm',
  'Anxious',
  'Withdrawn',
  'Agitated',
  'Hopeful',
  'Distressed',
  'Neutral',
  'Stable',
] as const

export const VISIT_TYPES = [
  'Initial Assessment',
  'Routine Follow-Up',
  'Reintegration Assessment',
  'Post-Placement Monitoring',
  'Emergency',
] as const

export const VISIT_OUTCOMES = ['Favorable', 'Needs Improvement', 'Unfavorable', 'Inconclusive'] as const

export const COOPERATION_LEVELS = ['Excellent', 'Good', 'Fair', 'Poor', 'Unknown'] as const

export const EDU_PROGRAMS = ['Bridge Program', 'Secondary Support', 'Vocational Skills', 'Literacy Boost'] as const
export const EDU_COURSES = ['Math', 'English', 'Science', 'Life Skills', 'Computer Basics', 'Livelihood'] as const
export const EDU_LEVELS = ['Primary', 'Secondary', 'Vocational', 'CollegePrep'] as const
export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent'] as const
export const COMPLETION_STATUSES = ['NotStarted', 'InProgress', 'Completed'] as const

export const INCIDENT_TYPES = [
  'Behavioral',
  'Medical',
  'Security',
  'RunawayAttempt',
  'SelfHarm',
  'ConflictWithPeer',
  'PropertyDamage',
] as const

export const SEVERITY_LEVELS = ['Low', 'Medium', 'High'] as const

export const PLAN_CATEGORIES = [
  'Safety',
  'Psychosocial',
  'Education',
  'Physical Health',
  'Legal',
  'Reintegration',
] as const

export const PLAN_STATUSES = ['Open', 'In Progress', 'Achieved', 'On Hold', 'Closed'] as const

export const CASE_STATUSES = ['Active', 'Inactive', 'Closed', 'Open', 'On Hold'] as const
export const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const
export const SEX_OPTIONS = ['F', 'M', 'Other', 'Unknown'] as const
