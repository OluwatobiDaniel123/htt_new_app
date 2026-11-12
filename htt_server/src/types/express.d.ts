import 'express-serve-static-core';
import type { AuthContext } from '../auth/auth.types.js';
import type { RegistrationImage } from '../middleware/publicRegistrationUpload.js';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
    auth?: AuthContext;
    validatedQuery?: Record<string, unknown>;
    validatedBody?: unknown;
    rawBody?: Buffer;
    registrationImage?: RegistrationImage;
  }
}
