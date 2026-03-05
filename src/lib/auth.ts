import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return null;

  return verifyToken(token);
}

export async function setSession(token: string): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete('auth-token');
}

// Role-based access control helpers
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function isPayrollAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PAYROLL_ADMIN;
}

export function canManageEmployees(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PAYROLL_ADMIN;
}

export function canManagePayroll(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PAYROLL_ADMIN;
}

export function canViewPayslips(role: UserRole): boolean {
  return true; // All roles can view payslips (own or all based on role)
}

export function canViewAllPayslips(role: UserRole): boolean {
  return role === UserRole.ADMIN || role === UserRole.PAYROLL_ADMIN;
}
