'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Vista dedicada del menú: reutiliza Gastos con la pestaña Proveedores.
 */
export default function SuppliersPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/expenses?tab=suppliers');
  }, [router]);
  return (
    <div className="p-8 flex items-center justify-center text-muted-foreground text-sm">
      Abriendo proveedores…
    </div>
  );
}
