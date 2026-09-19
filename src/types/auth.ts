/**
 * Multi-Account & Authentication Types
 */

export interface AccountProfile {
  id: string;             // Unique Account / Tenant ID (e.g. "acc_123456789")
  name: string;           // Company or Account Owner Name (e.g. "مؤسسة النور", "Acme Corp")
  email: string;          // Login identifier
  passwordHash?: string;  // Local secure hash
  currency: string;       // Default account currency (e.g. "SAR", "USD")
  createdAt: string;      // ISO timestamp
  lastLoginAt: string;    // ISO timestamp
}

export interface AuthState {
  currentAccount: AccountProfile | null;
  accounts: AccountProfile[];
  loading: boolean;
  error: string | null;
}

export interface SignUpParams {
  name: string;
  email: string;
  password?: string;
  currency?: string;
}

export interface SignInParams {
  email: string;
  password?: string;
  rememberMe?: boolean;
}
