'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function InventoryPage() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Inventario</h1>
            <p className="text-muted-foreground">Gestiona tus productos</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
          </Button>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No hay productos registrados
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
