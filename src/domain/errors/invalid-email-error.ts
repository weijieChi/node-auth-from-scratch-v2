export class InvalidEmailError extends Error {
  constructor() {
    super('Email address is invalid');

    this.name = 'InvalidEmailError';
  }
}
