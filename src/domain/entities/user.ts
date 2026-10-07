import type { Email } from '../value-objects/email.js';

export type UserStatus = 'ACTIVE' | 'DISABLED';

interface UserProps {
  id: string;
  email: Email;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  readonly id: string;
  readonly email: Email;
  readonly status: UserStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: UserProps) {
    this.id = props.id;
    this.email = props.email;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
