export const Status = {
  active: 'Active',
  blocked: 'Blocked',
  archived: 'Archived',
  inactive: 'Inactive',
  replaced: 'Replaced',
  deleted: 'Deleted',
  draft: 'Draft',
} as const;

export type Status = (typeof Status)[keyof typeof Status];
