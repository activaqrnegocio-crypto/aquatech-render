import { UserRole } from '@prisma/client'

export type Role = 'ADMIN' | 'ADMINISTRADORA' | 'OPERATOR' | 'SUBCONTRATISTA' | 'SUPERADMIN'

const ROLE_PERMISSIONS_DEFAULT: Record<string, string[]> = {
  'SUPERADMIN': ['dashboard', 'marketing', 'blog', 'calendario', 'proyectos', 'proyectos_admin', 'equipo', 'reportes', 'cotizaciones', 'inventario', 'recursos'],
  'ADMIN': ['dashboard', 'marketing', 'blog', 'calendario', 'proyectos', 'proyectos_admin', 'equipo', 'reportes', 'cotizaciones', 'inventario', 'recursos'],
  'ADMINISTRADORA': ['dashboard', 'marketing', 'blog', 'calendario', 'proyectos', 'proyectos_admin', 'equipo', 'reportes', 'cotizaciones', 'inventario', 'recursos'],
  'OPERATOR': ['proyectos', 'cotizaciones', 'inventario', 'recursos'],
  'OPERADOR': ['proyectos', 'cotizaciones', 'inventario', 'recursos'],
  'SUBCONTRATISTA': ['proyectos']
}

/**
 * Checks if a user role has administrative privileges.
 */
export function isAdmin(role?: string | null): boolean {
  if (!role) return false
  const r = String(role).trim().toUpperCase()
  return r === 'ADMIN' || r === 'ADMINISTRADORA' || r === 'SUPERADMIN'
}

/**
 * Checks if a user role is a field operator.
 */
export function isOperator(role?: string | null): boolean {
  if (!role) return false
  const r = String(role).trim().toUpperCase()
  return r === 'OPERATOR' || r === 'OPERADOR'
}

/**
 * Checks if a user role is a subcontractor.
 */
export function isSubcontractor(role?: string | null): boolean {
  if (!role) return false
  const r = String(role).trim().toUpperCase()
  return r === 'SUBCONTRATISTA'
}

/**
 * Helper to check if a user has access to a project.
 * Managers have access to all. Operators only to those they are part of or created.
 */
export function canAccessProject(user: { id: string | number; role: string }, projectTeam: { userId: number }[], creatorId?: number): boolean {
  if (isAdmin(user.role)) return true
  const uid = String(user.id)
  return projectTeam.some(member => String(member.userId) === uid)
}

/**
 * Robustly parses the permissions field into a string array.
 * If permissions is null, it falls back to role-based defaults.
 */
export function getPermissionsArray(permissions: string | null | any, role?: string | null): string[] {
  let perms: string[] = []
  
  if (permissions) {
    if (Array.isArray(permissions)) {
      perms = permissions
    } else {
      try {
        const p = String(permissions).trim()
        if (p.startsWith('[')) {
          const parsed = JSON.parse(p)
          perms = Array.isArray(parsed) ? parsed : []
        } else {
          perms = p.split(',').map(item => item.trim()).filter(Boolean)
        }
      } catch (e) {
        console.error('Error parsing permissions:', e)
      }
    }
  }

  // If we have no permissions but we have a role, use defaults
  if (perms.length === 0 && role) {
    const r = String(role).trim().toUpperCase()
    const defaults = ROLE_PERMISSIONS_DEFAULT[r] || []
    return defaults
  }

  return perms
}

/**
 * Checks if a user has access to a specific module based on their permissions field.
 * @param userPermissions The permissions string from the database (JSON or comma separated)
 * @param moduleSlug The internal name of the module (e.g., 'marketing')
 * @param userRole The role of the user (Superadmins have access to everything by default)
 */
export function hasModuleAccess(user: { permissions: string | null, role: string } | string | null, moduleSlug: string, userRole?: string): boolean {
  // Support both object and simple string/role arguments
  const permissionsInput = typeof user === 'object' && user !== null ? user.permissions : user as string | null
  const roleInput = typeof user === 'object' && user !== null ? user.role : userRole

  if (roleInput === 'SUPERADMIN') return true
  if (permissionsInput === 'all') return true

  const perms = getPermissionsArray(permissionsInput, roleInput)
  return perms.includes(moduleSlug)
}
