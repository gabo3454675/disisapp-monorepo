'use client';

import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
