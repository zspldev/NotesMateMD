import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'notesmate-dev-secret-key-change-in-production';
const TOKEN_EXPIRY_HOURS = 24;

export interface AuthContext {
  empid: string;
  orgid: string | null;
  role: string;
  impersonatedOrgId?: string;
  exp: number;
}

export function createAccessToken(context: Omit<AuthContext, 'exp'>): string {
  const payload: AuthContext = {
    ...context,
    exp: Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  };
  
  const jsonPayload = JSON.stringify(payload);
  const base64Payload = Buffer.from(jsonPayload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(base64Payload)
    .digest('base64url');
  
  return `${base64Payload}.${signature}`;
}

export function verifyAccessToken(token: string): AuthContext | null {
  try {
    const [base64Payload, signature] = token.split('.');
    
    if (!base64Payload || !signature) {
      return null;
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(base64Payload)
      .digest('base64url');
    
    if (signature !== expectedSignature) {
      console.warn('Token signature mismatch');
      return null;
    }
    
    const jsonPayload = Buffer.from(base64Payload, 'base64url').toString();
    const payload: AuthContext = JSON.parse(jsonPayload);
    
    if (payload.exp < Date.now()) {
      console.warn('Token expired');
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
