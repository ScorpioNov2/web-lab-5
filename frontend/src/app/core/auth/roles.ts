/**
 * Roles of the Java backend (`hasAuthority('ADMIN')` / `hasAuthority('USER')`, no ROLE_ prefix).
 * Reading students: ADMIN and USER. Creating / editing / deleting students: ADMIN only.
 * The backend enforces this for real; the frontend only mirrors it to hide what would be refused
 * and to protect routes.
 */
export const ROLES = ['ADMIN', 'USER'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that may create, edit and delete students. */
export const STUDENT_WRITE_ROLES: readonly Role[] = ['ADMIN'];

export const ROLE_LABELS: Record<Role, string> = {
	ADMIN: 'Администратор',
	USER: 'Пользователь',
};

/** "admin" / "ROLE_ADMIN" -> "ADMIN"; anything unknown -> null. */
export function normalizeRole(raw: unknown): Role | null {
	if (typeof raw !== 'string') return null;
	const value = raw
		.trim()
		.replace(/^ROLE_/i, '')
		.toUpperCase();
	return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

export function canManageStudents(role: Role | null): boolean {
	return role !== null && STUDENT_WRITE_ROLES.includes(role);
}
