'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Componente de debug para verificar permisos
 * Solo visible en desarrollo
 */
export function PermissionDebug() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const user = useAuthStore((state) => state.user);
  const selectedOrganizationId = useAuthStore((state) => state.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((state) => state.selectedCompanyId);
  const getCurrentOrganization = useAuthStore((state) => state.getCurrentOrganization);
  const permissions = usePermission();
  const currentOrg = getCurrentOrganization();

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-yellow-50 border-yellow-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">🔍 Debug Permisos</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div>
          <strong>Selected Org ID:</strong> {selectedOrganizationId || 'null'}
        </div>
        <div>
          <strong>Selected Company ID:</strong> {selectedCompanyId || 'null'}
        </div>
        <div>
          <strong>Current Org:</strong> {currentOrg ? JSON.stringify(currentOrg, null, 2) : 'null'}
        </div>
        <div>
          <strong>Role:</strong> {permissions.role}
        </div>
        <div>
          <strong>canManageTeam:</strong> {permissions.canManageTeam ? '✅' : '❌'}
        </div>
        <div>
          <strong>User Organizations:</strong>
          <pre className="text-xs mt-1 overflow-auto max-h-32">
            {JSON.stringify(user?.organizations, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
