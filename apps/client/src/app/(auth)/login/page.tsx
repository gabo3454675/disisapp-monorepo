'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { authService } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Mail, Lock, Loader2, Sparkles, ArrowRight } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('success') === 'password_changed') {
      setSuccessMessage('Contraseña actualizada correctamente. Inicia sesión con tu nueva contraseña.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { access_token, user } = await authService.login({ email, password });
      setAuth(user as unknown as Parameters<typeof setAuth>[0], access_token);
      if ((user as { companies?: unknown[] }).companies?.length) {
        router.push('/');
      } else {
        // Si no tiene empresas, podría redirigir a una página de bienvenida
        router.push('/');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Error al iniciar sesión. Verifica tus credenciales.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Decoración de fondo animada */}
      <div className="absolute -inset-4 opacity-20 blur-3xl">
        <div className="absolute top-0 left-0 w-64 h-64 bg-primary rounded-full animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500 rounded-full animate-pulse delay-1000"></div>
      </div>

      <Card className="relative w-full backdrop-blur-sm bg-card/95 border-2 shadow-2xl">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center mb-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
              <div className="relative bg-gradient-to-br from-primary to-indigo-600 p-4 rounded-2xl shadow-lg">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              Bienvenido de vuelta
            </CardTitle>
            <CardDescription className="text-base">
              Ingresa tus credenciales para acceder a tu cuenta
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {successMessage && (
              <div className="p-4 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                  {error}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 text-base border-2 focus:border-primary transition-colors"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 h-12 text-base border-2 focus:border-primary transition-colors"
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 shadow-lg hover:shadow-xl transition-all duration-200 group"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
            
            <div className="text-center text-sm pt-2 space-y-2">
              <div>
                <span className="text-muted-foreground">¿No tienes cuenta? </span>
                <Link 
                  href="/register" 
                  className="text-primary hover:text-primary/80 font-semibold hover:underline transition-colors inline-flex items-center gap-1"
                >
                  Regístrate aquí
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div>
                <Link 
                  href="/recover-password" 
                  className="text-sm text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
                >
                  ¿Olvidaste tu contraseña? Recupérala aquí
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  Te pediremos tu correo y tu nombre exactamente como aparece en tu perfil.
                </p>
              </div>
              <div>
                <Link 
                  href="/reset-password" 
                  className="text-sm text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                >
                  ¿Tienes contraseña temporal? Cámbiala aquí
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</p>}>
      <LoginForm />
    </Suspense>
  );
}
