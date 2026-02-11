'use client';

import { Suspense } from 'react';
import { ResetPasswordFormContent } from './ResetPasswordFormContent';

interface ResetPasswordFormProps {
  initialEmail?: string;
  fromProfile?: boolean;
}

/** Wrapper con Suspense para usar desde perfil/ajustes. La página /reset-password usa ResetPasswordFormContent directamente. */
export function ResetPasswordForm({ initialEmail, fromProfile }: ResetPasswordFormProps) {
  return (
    <Suspense fallback={<p className="flex items-center justify-center py-12 text-muted-foreground">Cargando...</p>}>
      <ResetPasswordFormContent initialEmail={initialEmail} fromProfile={fromProfile} />
    </Suspense>
  );
}
