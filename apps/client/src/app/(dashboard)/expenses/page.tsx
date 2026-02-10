'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, Search, Loader2, DollarSign, TrendingDown, Package, Briefcase } from 'lucide-react';
import dynamic from 'next/dynamic';
import apiClient from '@/lib/api';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useAuthStore } from '@/store/useAuthStore';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';

// Lazy load del componente de gráficos pesados
const ExpenseCharts = dynamic(() => import('@/components/expense-charts'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>,
});

interface Expense {
  id: number;
  date: string;
  amount: number;
  description: string;
  referenceNumber?: string | null;
  status: 'PENDING' | 'PAID';
  supplier?: {
    id: number;
    name: string;
  } | null;
  category: {
    id: number;
    name: string;
  };
}

interface Supplier {
  id: number;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

interface ExpenseCategory {
  id: number;
  name: string;
  description?: string | null;
}

interface ExpenseStats {
  totalMonth: number;
  inventoryTotal: number;
  operationalTotal: number;
  categoryBreakdown: {
    categoryId: number;
    categoryName: string;
    amount: number;
  }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ExpensesPage() {
  const { selectedCompanyId } = useAuthStore();
  const { canManageExpenses, canDelete } = usePermission();
  
  // Todos los hooks deben estar antes de cualquier retorno condicional
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { formatForDisplay } = useDisplayCurrency();

  const [expenseFormData, setExpenseFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    referenceNumber: '',
    status: 'PENDING' as 'PENDING' | 'PAID',
    supplierId: '',
    categoryId: '',
  });

  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
  });

  const fetchExpenses = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<Expense[]>('/expenses');
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      alert('Error al cargar los gastos');
    }
  }, [selectedCompanyId]);

  const fetchSuppliers = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<Supplier[]>('/suppliers');
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  }, [selectedCompanyId]);

  const fetchCategories = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<ExpenseCategory[]>('/expense-categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, [selectedCompanyId]);

  const fetchStats = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<ExpenseStats>('/expenses/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId && canManageExpenses) {
      setLoading(true);
      Promise.all([fetchExpenses(), fetchSuppliers(), fetchCategories(), fetchStats()]).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedCompanyId, canManageExpenses, fetchExpenses, fetchSuppliers, fetchCategories, fetchStats]);

  // useMemo debe estar antes del return condicional
  const filteredExpenses = useMemo(() => {
    if (!debouncedSearchQuery) return expenses;
    const query = debouncedSearchQuery.toLowerCase();
    return expenses.filter(
      (expense) =>
        expense.description.toLowerCase().includes(query) ||
        expense.supplier?.name.toLowerCase().includes(query) ||
        expense.category.name.toLowerCase().includes(query) ||
        expense.referenceNumber?.toLowerCase().includes(query)
    );
  }, [expenses, debouncedSearchQuery]);

  // Si no tiene permisos para gestionar gastos, mostrar mensaje después de todos los hooks
  if (!canManageExpenses) {
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

  const handleOpenExpenseDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseFormData({
        date: new Date(expense.date).toISOString().split('T')[0],
        amount: expense.amount.toString(),
        description: expense.description,
        referenceNumber: expense.referenceNumber || '',
        status: expense.status,
        supplierId: expense.supplier?.id.toString() || '',
        categoryId: expense.category.id.toString(),
      });
    } else {
      setEditingExpense(null);
      setExpenseFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        description: '',
        referenceNumber: '',
        status: 'PENDING',
        supplierId: '',
        categoryId: '',
      });
    }
    setIsExpenseDialogOpen(true);
  };

  const handleCloseExpenseDialog = () => {
    setIsExpenseDialogOpen(false);
    setEditingExpense(null);
  };

  const handleSaveExpense = async () => {
    if (!expenseFormData.amount || !expenseFormData.description || !expenseFormData.categoryId) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        date: expenseFormData.date,
        amount: parseFloat(expenseFormData.amount),
        description: expenseFormData.description,
        referenceNumber: expenseFormData.referenceNumber || undefined,
        status: expenseFormData.status,
        supplierId: expenseFormData.supplierId ? parseInt(expenseFormData.supplierId) : undefined,
        categoryId: parseInt(expenseFormData.categoryId),
      };

      if (editingExpense) {
        await apiClient.patch(`/expenses/${editingExpense.id}`, payload);
        alert('Gasto actualizado exitosamente');
      } else {
        await apiClient.post('/expenses', payload);
        alert('Gasto registrado exitosamente');
      }

      handleCloseExpenseDialog();
      fetchExpenses();
      fetchStats();
    } catch (error: any) {
      console.error('Error saving expense:', error);
      alert(error.response?.data?.message || 'Error al guardar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
      return;
    }

    try {
      await apiClient.delete(`/expenses/${id}`);
      alert('Gasto eliminado exitosamente');
      fetchExpenses();
      fetchStats();
    } catch (error: any) {
      console.error('Error deleting expense:', error);
      alert(error.response?.data?.message || 'Error al eliminar el gasto');
    }
  };

  const handleOpenSupplierDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierFormData({
        name: supplier.name,
        taxId: supplier.taxId || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
      });
    } else {
      setEditingSupplier(null);
      setSupplierFormData({
        name: '',
        taxId: '',
        email: '',
        phone: '',
        address: '',
      });
    }
    setIsSupplierDialogOpen(true);
  };

  const handleCloseSupplierDialog = () => {
    setIsSupplierDialogOpen(false);
    setEditingSupplier(null);
  };

  const handleSaveSupplier = async () => {
    if (!supplierFormData.name) {
      alert('El nombre es requerido');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        await apiClient.patch(`/suppliers/${editingSupplier.id}`, supplierFormData);
        alert('Proveedor actualizado exitosamente');
      } else {
        await apiClient.post('/suppliers', supplierFormData);
        alert('Proveedor creado exitosamente');
      }

      handleCloseSupplierDialog();
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      alert(error.response?.data?.message || 'Error al guardar el proveedor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proveedor?')) {
      return;
    }

    try {
      await apiClient.delete(`/suppliers/${id}`);
      alert('Proveedor eliminado exitosamente');
      fetchSuppliers();
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      alert(error.response?.data?.message || 'Error al eliminar el proveedor');
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Preparar datos para gráfico de torta
  const pieChartData = stats?.categoryBreakdown.map((item, index) => ({
    name: item.categoryName,
    value: item.amount,
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Gestión de Gastos</h1>
            <p className="text-muted-foreground">Registra y monitorea los egresos de tu empresa</p>
          </div>
          {canManageExpenses && (
            <Button onClick={() => handleOpenExpenseDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Gasto
            </Button>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatForDisplay(stats.totalMonth) : formatForDisplay(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facturas de Proveedores</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatForDisplay(stats.inventoryTotal) : formatForDisplay(0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gastos Operativos</CardTitle>
              <Briefcase className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats ? formatForDisplay(stats.operationalTotal) : formatForDisplay(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos (Lazy Loaded) */}
        {stats && stats.categoryBreakdown.length > 0 && (
          <ExpenseCharts categoryBreakdown={stats.categoryBreakdown} formatCurrency={formatForDisplay} />
        )}

        {/* Tabs para Gastos y Proveedores */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="expenses">Gastos</TabsTrigger>
            <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Historial de Gastos</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar gastos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No hay gastos registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Monto</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{formatDate(expense.date)}</TableCell>
                            <TableCell>{expense.supplier?.name || '-'}</TableCell>
                            <TableCell>{expense.category.name}</TableCell>
                            <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                            <TableCell>{expense.referenceNumber || '-'}</TableCell>
                            <TableCell className="font-semibold">
                              {formatForDisplay(expense.amount)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  expense.status === 'PAID'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                }`}
                              >
                                {expense.status === 'PAID' ? 'Pagado' : 'Pendiente'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {canManageExpenses && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenExpenseDialog(expense)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteExpense(expense.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle>Proveedores</CardTitle>
                  {canManageExpenses && (
                    <Button onClick={() => handleOpenSupplierDialog()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nuevo Proveedor
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {suppliers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No hay proveedores registrados
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>RIF/ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suppliers.map((supplier) => (
                          <TableRow key={supplier.id}>
                            <TableCell className="font-medium">{supplier.name}</TableCell>
                            <TableCell>{supplier.taxId || '-'}</TableCell>
                            <TableCell>{supplier.email || '-'}</TableCell>
                            <TableCell>{supplier.phone || '-'}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenSupplierDialog(supplier)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteSupplier(supplier.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog para Registrar/Editar Gasto */}
        <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}
              </DialogTitle>
              <DialogDescription>
                Completa los datos del gasto o compra realizada
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Fecha *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={expenseFormData.date}
                    onChange={(e) =>
                      setExpenseFormData({ ...expenseFormData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Monto (USD) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={expenseFormData.amount}
                    onChange={(e) =>
                      setExpenseFormData({ ...expenseFormData, amount: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoría *</Label>
                <select
                  id="categoryId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={expenseFormData.categoryId}
                  onChange={(e) =>
                    setExpenseFormData({ ...expenseFormData, categoryId: e.target.value })
                  }
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierId">Proveedor (Opcional)</Label>
                <select
                  id="supplierId"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={expenseFormData.supplierId}
                  onChange={(e) =>
                    setExpenseFormData({ ...expenseFormData, supplierId: e.target.value })
                  }
                >
                  <option value="">Sin proveedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Número de Referencia</Label>
                <Input
                  id="referenceNumber"
                  value={expenseFormData.referenceNumber}
                  onChange={(e) =>
                    setExpenseFormData({ ...expenseFormData, referenceNumber: e.target.value })
                  }
                  placeholder="Nro. de factura del proveedor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <Input
                  id="description"
                  value={expenseFormData.description}
                  onChange={(e) =>
                    setExpenseFormData({ ...expenseFormData, description: e.target.value })
                  }
                  placeholder="Descripción del gasto"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={expenseFormData.status}
                  onChange={(e) =>
                    setExpenseFormData({
                      ...expenseFormData,
                      status: e.target.value as 'PENDING' | 'PAID',
                    })
                  }
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="PAID">Pagado</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseExpenseDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSaveExpense} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para Crear/Editar Proveedor */}
        <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </DialogTitle>
              <DialogDescription>
                {editingSupplier
                  ? 'Actualiza la información del proveedor'
                  : 'Registra un nuevo proveedor en el sistema'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Nombre *</Label>
                <Input
                  id="supplier-name"
                  value={supplierFormData.name}
                  onChange={(e) =>
                    setSupplierFormData({ ...supplierFormData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-taxId">RIF/ID</Label>
                <Input
                  id="supplier-taxId"
                  value={supplierFormData.taxId}
                  onChange={(e) =>
                    setSupplierFormData({ ...supplierFormData, taxId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={supplierFormData.email}
                  onChange={(e) =>
                    setSupplierFormData({ ...supplierFormData, email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Teléfono</Label>
                <Input
                  id="supplier-phone"
                  value={supplierFormData.phone}
                  onChange={(e) =>
                    setSupplierFormData({ ...supplierFormData, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-address">Dirección</Label>
                <Input
                  id="supplier-address"
                  value={supplierFormData.address}
                  onChange={(e) =>
                    setSupplierFormData({ ...supplierFormData, address: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseSupplierDialog}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSupplier} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
