'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/lib/api';
import { ArrowRight, Loader2, Mail, Lock, UserRound, KeyRound } from 'lucide-react';

export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.recoverPassword({
        email: email.trim(),
        fullName: fullName.trim(),
        newPassword,
      });
      setSuccess(res.message || 'Clave actualizada correctamente. Ya puedes iniciar sesión.');
      setEmail('');
      setFullName('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo recuperar la clave. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <Card className="relative w-full backdrop-blur-sm bg-card/95 border-2 shadow-2xl">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center mb-2">
            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg">
              <KeyRound className="h-8 w-8 text-white" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">Recuperar contraseña</CardTitle>
            <CardDescription>
              Restablece tu clave dentro del sistema. Ingresa el mismo correo y tu nombre exactamente como está
              registrado (incluyendo acentos si aplica).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">{error}</div>}
            {success && (
              <div className="p-3 text-sm text-green-700 bg-green-50 rounded-lg border border-green-200">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Correo electrónico
              </label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                Nombre completo
              </label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Youssy Estrada"
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Debe coincidir con el nombre guardado en tu cuenta.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Nueva contraseña
              </label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} disabled={loading} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Confirmar contraseña
              </label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} disabled={loading} />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  Restablecer clave
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">
                Volver al login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

