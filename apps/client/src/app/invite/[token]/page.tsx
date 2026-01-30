'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, LogIn, UserPlus } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import Link from 'next/link';

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { isAuthenticated, user } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<{
    organizationName: string;
    inviterName: string;
    role: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Verificar el token de invitación (opcional: puedes crear un endpoint para esto)
    // Por ahora, solo verificamos cuando el usuario acepta
    setLoading(false);
  }, [token]);

  const handleAcceptInvitation = async () => {
    if (!isAuthenticated) {
      // Redirigir a login con el token en la URL para volver después
      router.push(`/login?invite=${token}`);
      return;
    }

    setAccepting(true);
    setError(null);

    try {
      await apiClient.post(`/invitations/accept/${token}`);
      setSuccess(true);
      
      // Actualizar las organizaciones del usuario
      const authStore = useAuthStore.getState();
      // Refrescar las organizaciones del usuario
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      const errorMessage = error.response?.data?.message || 'Error al aceptar la invitación';
      setError(errorMessage);
    } finally {
      setAccepting(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {success ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">¡Invitación Aceptada!</CardTitle>
              <CardDescription>
                Has sido agregado exitosamente a la organización.
                Redirigiendo al dashboard...
              </CardDescription>
            </>
          ) : error ? (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Error</CardTitle>
              <CardDescription className="text-red-600">{error}</CardDescription>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                <UserPlus className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Invitación a Organización</CardTitle>
              <CardDescription>
                Te han invitado a unirte a una organización
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : success ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Serás redirigido al dashboard en unos segundos...
              </p>
              <Button onClick={() => router.push('/')} className="w-full">
                Ir al Dashboard
              </Button>
            </div>
          ) : error ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {error.includes('expirada') || error.includes('expirado')
                    ? 'Esta invitación ha expirado. Contacta al administrador para una nueva invitación.'
                    : error.includes('procesada')
                    ? 'Esta invitación ya fue aceptada anteriormente.'
                    : 'Ocurrió un error al procesar la invitación.'}
                </p>
              </div>
              {isAuthenticated ? (
                <Button onClick={() => router.push('/')} variant="outline" className="w-full">
                  Volver al Dashboard
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button onClick={() => router.push('/login')} className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Iniciar Sesión
                  </Button>
                  <Button
                    onClick={() => router.push('/register')}
                    variant="outline"
                    className="w-full"
                  >
                    Crear Cuenta
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Información de la Invitación</p>
                  {invitation ? (
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>
                        <strong>Organización:</strong> {invitation.organizationName}
                      </p>
                      <p>
                        <strong>Rol:</strong> {getRoleLabel(invitation.role)}
                      </p>
                      {invitation.inviterName && (
                        <p>
                          <strong>Invitado por:</strong> {invitation.inviterName}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Haz clic en el botón de abajo para aceptar la invitación y unirte a la organización.
                    </p>
                  )}
                </div>

                {!isAuthenticated ? (
                  <div className="space-y-3">
                    <p className="text-sm text-center text-muted-foreground">
                      Para aceptar esta invitación, necesitas iniciar sesión o crear una cuenta.
                    </p>
                    <Button onClick={() => router.push(`/login?invite=${token}`)} className="w-full">
                      <LogIn className="mr-2 h-4 w-4" />
                      Iniciar Sesión
                    </Button>
                    <Button
                      onClick={() => router.push(`/register?invite=${token}`)}
                      variant="outline"
                      className="w-full"
                    >
                      Crear Cuenta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-center text-muted-foreground">
                      Haz clic en el botón de abajo para aceptar la invitación y unirte a la organización.
                    </p>
                    <Button
                      onClick={handleAcceptInvitation}
                      disabled={accepting}
                      className="w-full"
                    >
                      {accepting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Aceptando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Aceptar Invitación
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
