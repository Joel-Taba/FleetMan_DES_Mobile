export type AuthUser = {
  id: string;
  username: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  roles: string[];
  photoUrl?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

/** Raw user payload of POST /api/v1/auth/login and /refresh (content of `data`). */
export type AuthPayloadUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roles?: string[] | null;
  photoUrl?: string | null;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken?: string | null;
  user: AuthPayloadUser;
};

export const DRIVER_ROLE = "FLEET_DRIVER";
