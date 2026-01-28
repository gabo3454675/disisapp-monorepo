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
import { Plus, Loader2, UserPlus, Mail, Shield, User } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface Member {
  id: number;
  userId: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'SELLER' | 'WAREHOUSE';
  status: string;
  joinedAt: string;
}

export default function TeamPage() {
  const { selectedOrganizationId, selectedCompanyId } = useAuthStore();
  const { canManageTeam } = usePermission();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'SELLER' as 'ADMIN' | 'SELLER',
  });

  const organizationId = selectedOrganizationId || selectedCompanyId;

  const fetchMembers = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<Member[]>('/invitations/members');
      setMembers(response.data);
    } catch (error: any) {
      console.error('Error fetching members:', error);
      alert('Error al cargar los miembros del equipo');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleOpenInviteDialog = () => {
    setInviteFormData({ email: '', role: 'SELLER' });
    setIsInviteDialogOpen(true);
  };

  const handleCloseInviteDialog = () => {
    setIsInviteDialogOpen(false);
    setInviteFormData({ email: '', role: 'SELLER' });
  };

  const handleInviteMember = async () => {
    if (!inviteFormData.email || !inviteFormData.email.includes('@')) {
      alert('Por favor ingresa un email válido');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/invitations', {
        email: inviteFormData.email,
        role: inviteFormData.role,
      });
      alert('Invitación enviada exitosamente');
      handleCloseInviteDialog();
      fetchMembers();
    } catch (error: any) {
      console.error('Error inviting member:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar la invitación';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      OWNER: 'Propietario',
      ADMIN: 'Gerente',
      SELLER: 'Cajero/Vendedor',
      WAREHOUSE: 'Almacén',
    };
    return labels[role] || role;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'OWNER') return 'default';
    if (role === 'ADMIN') return 'secondary';
    return 'outline';
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
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleLabel(member.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(member.joinedAt).toLocaleDateString('es-VE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
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
                onValueChange={(value: 'ADMIN' | 'SELLER') =>
                  setInviteFormData({ ...inviteFormData, role: value })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Gerente (ADMIN)</SelectItem>
                  <SelectItem value="SELLER">Cajero/Vendedor (SELLER)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El Gerente puede gestionar el equipo y configuraciones. El Cajero/Vendedor solo puede realizar ventas.
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
    </div>
  );
}
