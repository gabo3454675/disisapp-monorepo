'use client';

import { Suspense } from 'react';
import { ResetPasswordFormContent } from '@/components/auth/ResetPasswordFormContent';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</p>}>
      <ResetPasswordFormContent />
    </Suspense>
  );
}
