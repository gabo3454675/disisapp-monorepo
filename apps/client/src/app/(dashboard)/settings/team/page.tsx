'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Loader2, UserPlus, Mail, Shield, User, Copy, Check, Link2, TrendingUp, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Member {
  id: number;
  userId: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE';
  status: string;
  joinedAt: string;
}

const ROLES_FOR_SELECT: { value: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE'; label: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Administrador' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'SELLER', label: 'Cajero/Vendedor' },
  { value: 'WAREHOUSE', label: 'Almacén' },
];

export default function TeamPage() {
  const { user, selectedOrganizationId, selectedCompanyId, getCurrentOrganization, setOrganizationExchangeRate } = useAuthStore();
  const { canManageTeam, isSuperAdmin, isAdmin } = usePermission();
  const currentUserId = user?.id ?? 0;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'SELLER' as 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE',
  });
  const currentOrg = getCurrentOrganization();
  const orgWithRate = currentOrg && 'exchangeRate' in currentOrg ? currentOrg : null;
  const [exchangeRate, setExchangeRate] = useState<string>(
    orgWithRate?.exchangeRate != null ? String(orgWithRate.exchangeRate) : '1'
  );
  const [savingRate, setSavingRate] = useState(false);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<number | null>(null);
  const [deactivatingMemberId, setDeactivatingMemberId] = useState<number | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Member | null>(null);

  const organizationId = selectedOrganizationId || selectedCompanyId;

  const fetchMembers = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<Member[]>('/tenants/organization/members');
      setMembers(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      const msg = error?.response?.data?.message || error?.message || 'Error al cargar los miembros del equipo';
      alert(msg);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (orgWithRate?.exchangeRate != null) {
      setExchangeRate(String(orgWithRate.exchangeRate));
    }
  }, [orgWithRate?.exchangeRate]);

  const handleSaveExchangeRate = async () => {
    if (!organizationId) return;
    const num = parseFloat(exchangeRate.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0) {
      alert('Ingresa una tasa válida mayor a 0');
      return;
    }
    setSavingRate(true);
    try {
      const { data } = await apiClient.patch<{ exchangeRate: number }>('/tenants/organization', { exchangeRate: num });
      setOrganizationExchangeRate(organizationId, data.exchangeRate);
      setExchangeRate(String(data.exchangeRate));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar la tasa';
      alert(msg);
    } finally {
      setSavingRate(false);
    }
  };

  const handleOpenInviteDialog = () => {
    setInviteFormData({ email: '', role: 'SELLER' });
    setIsInviteDialogOpen(true);
  };

  const handleCloseInviteDialog = () => {
    setIsInviteDialogOpen(false);
    setInviteFormData({ email: '', role: 'SELLER' });
  };

  const handleCloseLinkDialog = () => {
    setIsLinkDialogOpen(false);
    setInvitationLink('');
    setCopied(false);
  };

  const handleInviteMember = async () => {
    if (!inviteFormData.email || !inviteFormData.email.includes('@')) {
      alert('Por favor ingresa un email válido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<{
        invitation: any;
        token: string;
        invitationUrl: string;
      }>('/invitations', {
        email: inviteFormData.email,
        role: inviteFormData.role,
      });

      // Construir la URL completa de invitación
      // El backend retorna: /accept-invitation?token=xxx
      // Necesitamos convertirla a: /invite/xxx (formato de Next.js)
      const baseUrl = window.location.origin;
      const token = response.data.token;
      const fullInvitationUrl = `${baseUrl}/invite/${token}`;
      
      setInvitationLink(fullInvitationUrl);
      handleCloseInviteDialog();
      setIsLinkDialogOpen(true);
      fetchMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar la invitación';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Error al copiar el link');
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'Super Administrador',
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      SELLER: 'Cajero/Vendedor',
      WAREHOUSE: 'Almacén',
    };
    return labels[role] || role;
  };

  /** Badges de rol: Owner=dorado/negro, Admin=azul, Manager=verde, resto=gris */
  const getRoleBadgeClassName = (role: string) => {
    const base = 'font-medium';
    switch (String(role).toUpperCase()) {
      case 'SUPER_ADMIN':
        return `${base} bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40`;
      case 'ADMIN':
        return `${base} bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40`;
      case 'MANAGER':
        return `${base} bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40`;
      case 'SELLER':
        return `${base} bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/40`;
      case 'WAREHOUSE':
        return `${base} bg-slate-400/20 text-slate-500 dark:text-slate-400 border-slate-400/40`;
      default:
        return `${base} bg-muted text-muted-foreground border-border`;
    }
  };

  const getUserInitials = (member: Member) => {
    if (member.fullName) {
      return member.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return member.email.slice(0, 2).toUpperCase();
  };

  const canChangeRole = (member: Member) => {
    if (member.role === 'SUPER_ADMIN' && !isSuperAdmin) return false;
    return isSuperAdmin || isAdmin;
  };

  const handleRoleChange = async (member: Member, newRole: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE') => {
    if (newRole === member.role) return;
    setUpdatingRoleMemberId(member.id);
    try {
      await apiClient.patch(`/tenants/organization/members/${member.id}/role`, { newRole });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m))
      );
      toast.success('Rol actualizado', {
        description: `${member.fullName || member.email} ahora es ${getRoleLabel(newRole)}.`,
      });
    } catch (err: any) {
      toast.error('Error al cambiar el rol', {
        description: err?.response?.data?.message || 'No se pudo actualizar el rol.',
      });
    } finally {
      setUpdatingRoleMemberId(null);
    }
  };

  const handleDesactivarClick = (member: Member) => {
    setConfirmDeactivate(member);
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    const name = confirmDeactivate.fullName || confirmDeactivate.email;
    setDeactivatingMemberId(confirmDeactivate.id);
    try {
      await apiClient.delete(`/tenants/organization/members/${confirmDeactivate.id}`);
      setMembers((prev) => prev.filter((m) => m.id !== confirmDeactivate.id));
      setConfirmDeactivate(null);
      toast.success('Usuario desactivado', {
        description: `${name} ya no tiene acceso a la organización. Sus facturas se mantienen.`,
      });
    } catch (err: any) {
      toast.error('Error al desactivar', {
        description: err?.response?.data?.message || 'No se pudo desactivar al usuario.',
      });
    } finally {
      setDeactivatingMemberId(null);
    }
  };

  if (!canManageTeam) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No tienes permisos para acceder a esta sección.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Mi Equipo</h1>
            <p className="text-muted-foreground">
              Gestiona los miembros de tu organización
            </p>
          </div>
          <Button onClick={handleOpenInviteDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invitar Miembro
          </Button>
        </div>

        {/* Tasa de cambio - Solo Admin */}
        {canManageTeam && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tasa BCV / Paralelo
              </CardTitle>
              <CardDescription>
                Tasa de cambio para conversiones (ej. USD a VES). Solo usuarios con permisos de administración pueden modificarla.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 flex-1 min-w-[140px]">
                <Label htmlFor="exchangeRate">Tasa actual</Label>
                <Input
                  id="exchangeRate"
                  type="text"
                  inputMode="decimal"
                  placeholder="36.50"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveExchangeRate} disabled={savingRate}>
                {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {savingRate ? ' Guardando...' : 'Guardar tasa'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle>Miembros de la Organización</CardTitle>
            <CardDescription>
              Lista de todos los miembros activos en tu organización
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay miembros en esta organización</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Fecha de Ingreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {member.avatarUrl ? (
                              <img src={member.avatarUrl} alt={member.fullName || member.email} />
                            ) : (
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-emerald-500 text-white font-semibold">
                                {getUserInitials(member)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.fullName || 'Sin nombre'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{member.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canChangeRole(member) ? (
                          <Select
                            value={member.role}
                            onValueChange={(value: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE') =>
                              handleRoleChange(member, value)
                            }
                            disabled={updatingRoleMemberId === member.id}
                          >
                            <SelectTrigger className={getRoleBadgeClassName(member.role) + ' w-[180px]'}>
                              {updatingRoleMemberId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <SelectValue />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES_FOR_SELECT.filter(
                                (r) => isSuperAdmin || r.value !== 'SUPER_ADMIN'
                              ).map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={getRoleBadgeClassName(member.role)}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {getRoleLabel(member.role)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(member.joinedAt).toLocaleDateString('es-VE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.userId !== currentUserId &&
                          (member.role !== 'SUPER_ADMIN' || isSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDesactivarClick(member)}
                              disabled={deactivatingMemberId === member.id}
                              title="Desactivar usuario"
                            >
                              {deactivatingMemberId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invitar Miembro</DialogTitle>
            <DialogDescription>
              Envía una invitación por email para que se una a tu organización
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={inviteFormData.email}
                onChange={(e) =>
                  setInviteFormData({ ...inviteFormData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={inviteFormData.role}
                onValueChange={(value: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SELLER' | 'WAREHOUSE') =>
                  setInviteFormData({ ...inviteFormData, role: value })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && (
                    <SelectItem value="ADMIN">Administrador (ADMIN)</SelectItem>
                  )}
                  <SelectItem value="MANAGER">Gerente (MANAGER)</SelectItem>
                  <SelectItem value="SELLER">Cajero/Vendedor (SELLER)</SelectItem>
                  <SelectItem value="WAREHOUSE">Almacén (WAREHOUSE)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El Gerente puede gestionar el equipo y configuraciones. El Cajero/Vendedor solo puede realizar ventas. Almacén gestiona inventario.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseInviteDialog}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button onClick={handleInviteMember} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Enviar Invitación
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación Desactivar miembro */}
      <Dialog
        open={!!confirmDeactivate}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Desactivar usuario</DialogTitle>
            <DialogDescription>
              ¿Seguro? El usuario perderá acceso a la organización, pero sus facturas y actividad se mantendrán.
            </DialogDescription>
          </DialogHeader>
          {confirmDeactivate && (
            <p className="text-sm text-muted-foreground py-2">
              <strong>{confirmDeactivate.fullName || confirmDeactivate.email}</strong> ya no podrá iniciar sesión en esta organización.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeactivate} disabled={!!deactivatingMemberId}>
              {deactivatingMemberId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Invitation Dialog - Muestra el link de invitación */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              Invitación Creada Exitosamente
            </DialogTitle>
            <DialogDescription>
              Copia el siguiente link y compártelo con <strong>{inviteFormData.email}</strong> para que se una a tu organización.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invitation-link" className="text-sm font-medium">
                Link de Invitación
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="invitation-link"
                    value={invitationLink}
                    readOnly
                    className="pl-9 pr-20 font-mono text-sm bg-muted"
                  />
                </div>
                <Button
                  onClick={handleCopyLink}
                  variant={copied ? 'default' : 'outline'}
                  size="icon"
                  className="shrink-0"
                  title={copied ? 'Copiado!' : 'Copiar link'}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Link copiado al portapapeles
                </p>
              )}
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>📧 Instrucciones:</strong>
              </p>
              <ol className="text-xs text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-decimal list-inside">
                <li>Copia el link de arriba</li>
                <li>Envíalo por WhatsApp, Email o el método que prefieras</li>
                <li>El usuario debe hacer clic en el link para aceptar la invitación</li>
                <li>El link expira en 7 días</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseLinkDialog} variant="outline">
              Cerrar
            </Button>
            <Button onClick={handleCopyLink} variant="default">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
