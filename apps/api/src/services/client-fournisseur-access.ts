import { PermissionType, Role } from '../generated/prisma/enums';

export type CfAuth = { userId: string; role: Role };
export type CfAclRow = { id: string; createdById: string | null };

export function isAdminRole(role: string) {
  return role === 'admin';
}

export function isLegacyOpen(cf: CfAclRow) {
  return cf.createdById == null;
}

export function canViewCf(cf: CfAclRow, auth: CfAuth, userPermTypes: PermissionType[]) {
  if (isAdminRole(auth.role)) return true;
  if (cf.createdById === auth.userId) return true;
  if (userPermTypes.length > 0) return true;
  if (isLegacyOpen(cf) && auth.role === 'contributeur') return true;
  return false;
}

export function canModifyCf(cf: CfAclRow, auth: CfAuth, userPermTypes: PermissionType[]) {
  if (isAdminRole(auth.role)) return true;
  if (cf.createdById === auth.userId) return true;
  if (isLegacyOpen(cf) && auth.role === 'contributeur') return true;
  return userPermTypes.some((p) => p === 'modification' || p === 'suppression' || p === 'gestion');
}

export function canDeleteCf(cf: CfAclRow, auth: CfAuth, userPermTypes: PermissionType[]) {
  if (isAdminRole(auth.role)) return true;
  if (cf.createdById === auth.userId) return true;
  if (isLegacyOpen(cf) && auth.role === 'contributeur') return true;
  return userPermTypes.includes('suppression');
}

/** Octroi / retrait de droits : administrateur ou créateur de la fiche (fiches sans créateur : admin uniquement). */
export function canManageCfPermissions(cf: CfAclRow, auth: CfAuth) {
  if (isAdminRole(auth.role)) return true;
  if (cf.createdById && cf.createdById === auth.userId) return true;
  return false;
}

export function capabilitiesFor(cf: CfAclRow, auth: CfAuth, userPermTypes: PermissionType[]) {
  return {
    canView: canViewCf(cf, auth, userPermTypes),
    canModify: canModifyCf(cf, auth, userPermTypes),
    canDelete: canDeleteCf(cf, auth, userPermTypes),
    canManagePermissions: canManageCfPermissions(cf, auth),
  };
}
