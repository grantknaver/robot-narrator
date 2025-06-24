import { Status } from '../enums/status';
import { UserRole } from '../enums/userRole';

export interface User {
  lastName?: string;
  firstName?: string;
  email: string;
  password?: string;
  role?: UserRole;
  userStatus?: Status;
  gdprAccepted?: boolean;
}
