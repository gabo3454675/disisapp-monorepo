'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Download, Share2, Loader2, CheckCircle, XCircle, MessageCircle, QrCode, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';

interface InvoiceItem {
  id: number;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  product: {
    id: number;
    name: string;
  };
}

interface Customer {
  id: number;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Organization {
  id: number;
  nombre: string;
  slug: string;
}

interface Invoice {
  id: number;
  totalAmount: string;
  status: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  markedAsPaidByClient?: boolean;
  markedAsPaidAt?: string;
  markedAsPaidBy?: string;
  viewCount?: number;
  items: InvoiceItem[];
  customer?: Customer;
  company: {
    id: number;
    name: string;
    taxId?: string;
    address?: string;
    logoUrl?: string;
  };
  organization?: Organization;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params?.token as string;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    if (!token) return;

    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/invoices/public/${token}`,
        );
        setInvoice(response.data);
        setError(null);
      } catch (err: any) {
        setError(
          err.response?.data?.message || 'No se pudo cargar la factura',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [token]);

  const handleDownloadPDF = () => {
    if (!token) return;
    const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/invoices/public/${token}/pdf`;
    window.open(pdfUrl, '_blank');
  };

  const handleShareWhatsApp = () => {
    if (!token) return;
    const currentUrl = window.location.href;
    const message = encodeURIComponent(
      `Hola, aquí tienes tu factura: ${currentUrl}`,
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const handleMarkAsPaid = async () => {
    if (!token) return;
    
    try {
      setMarkingAsPaid(true);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/invoices/public/${token}/mark-paid`,
        {
          markedBy: clientName || invoice?.customer?.name || undefined,
        },
      );
      
      // Actualizar el estado local
      setInvoice({
        ...invoice!,
        markedAsPaidByClient: true,
        markedAsPaidAt: new Date().toISOString(),
        markedAsPaidBy: clientName || invoice?.customer?.name || 'Cliente',
        status: 'PAID',
      });
      
      setShowMarkPaidDialog(false);
      setClientName('');
      
      // Mostrar mensaje de éxito
      alert('¡Gracias! La factura ha sido marcada como pagada.');
    } catch (err: any) {
      alert(
        err.response?.data?.message || 'Error al marcar la factura como pagada',
      );
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-VE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Cargando factura...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Factura no encontrada</h2>
              <p className="text-gray-600">{error || 'La factura solicitada no existe'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = parseFloat(invoice.totalAmount);
  const tax = 0; // Sin impuestos por ahora
  const total = subtotal + tax;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const canMarkAsPaid = invoice && !invoice.markedAsPaidByClient && invoice.status !== 'PAID';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 relative">
      {/* Botones flotantes */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {/* Botón QR Code */}
        <Button
          onClick={() => setShowQRDialog(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 flex items-center justify-center p-0"
          size="lg"
          title="Mostrar código QR"
        >
          <QrCode className="h-6 w-6 text-white" />
        </Button>
        
        {/* Botón WhatsApp */}
        <Button
          onClick={handleShareWhatsApp}
          className="h-14 w-14 rounded-full shadow-lg bg-green-500 hover:bg-green-600 flex items-center justify-center p-0"
          size="lg"
          title="Compartir en WhatsApp"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </Button>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Header con botones de acción */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Factura</h1>
            <p className="text-gray-600 mt-1">
              #{invoice.id} • {formatDate(invoice.createdAt)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canMarkAsPaid && (
              <Dialog open={showMarkPaidDialog} onOpenChange={setShowMarkPaidDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2 bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar como Pagada
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Pago</DialogTitle>
                    <DialogDescription>
                      ¿Confirmas que esta factura ha sido pagada?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName">
                        Tu nombre (opcional)
                      </Label>
                      <Input
                        id="clientName"
                        placeholder={invoice?.customer?.name || 'Nombre del cliente'}
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowMarkPaidDialog(false);
                          setClientName('');
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleMarkAsPaid}
                        disabled={markingAsPaid}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {markingAsPaid ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Confirmar Pago
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {invoice?.markedAsPaidByClient && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Marcada como pagada
                  {invoice.markedAsPaidAt && (
                    <span className="text-green-600 ml-1">
                      • {new Date(invoice.markedAsPaidAt).toLocaleDateString('es-VE')}
                    </span>
                  )}
                </span>
              </div>
            )}
            <Button onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Card principal */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-start justify-between">
              <div>
                {invoice.company.logoUrl && (
                  <Image
                    src={invoice.company.logoUrl}
                    alt={invoice.company.name}
                    width={64}
                    height={64}
                    className="h-16 mb-4 object-contain"
                    unoptimized
                  />
                )}
                <CardTitle className="text-2xl mb-2">
                  {invoice.company.name}
                </CardTitle>
                {invoice.company.taxId && (
                  <p className="text-blue-100 text-sm">
                    RIF: {invoice.company.taxId}
                  </p>
                )}
                {invoice.company.address && (
                  <p className="text-blue-100 text-sm mt-1">
                    {invoice.company.address}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                  {invoice.status === 'PAID' ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Pagada</span>
                    </>
                  ) : invoice.status === 'PENDING' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-medium">Pendiente</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Cancelada</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {/* Datos del Cliente */}
            {invoice.customer && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Datos del Cliente
                </h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="text-gray-900">
                    <span className="font-medium">Nombre:</span>{' '}
                    {invoice.customer.name}
                  </p>
                  {invoice.customer.taxId && (
                    <p className="text-gray-700">
                      <span className="font-medium">Documento:</span>{' '}
                      {invoice.customer.taxId}
                    </p>
                  )}
                  {invoice.customer.email && (
                    <p className="text-gray-700">
                      <span className="font-medium">Email:</span>{' '}
                      {invoice.customer.email}
                    </p>
                  )}
                  {invoice.customer.phone && (
                    <p className="text-gray-700">
                      <span className="font-medium">Teléfono:</span>{' '}
                      {invoice.customer.phone}
                    </p>
                  )}
                  {invoice.customer.address && (
                    <p className="text-gray-700">
                      <span className="font-medium">Dirección:</span>{' '}
                      {invoice.customer.address}
                    </p>
                  )}
                </div>
              </div>
            )}

            <Separator className="my-6" />

            {/* Tabla de Items */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Detalle de la Factura
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Producto
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                        Cantidad
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Precio Unit.
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4 text-gray-900">
                          {item.product.name}
                        </td>
                        <td className="py-4 px-4 text-center text-gray-700">
                          {item.quantity}
                        </td>
                        <td className="py-4 px-4 text-right text-gray-700">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="py-4 px-4 text-right font-medium text-gray-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totales */}
            <div className="ml-auto w-full sm:w-80">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Impuestos:</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total:</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Notas */}
            {invoice.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Notas:
                </h4>
                <p className="text-gray-600 text-sm">{invoice.notes}</p>
              </div>
            )}

            {/* Método de pago */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Método de pago:</span>{' '}
                {invoice.paymentMethod === 'CASH'
                  ? 'Efectivo'
                  : invoice.paymentMethod === 'CARD'
                    ? 'Tarjeta'
                    : invoice.paymentMethod}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Gracias por su compra • Generado el{' '}
            {new Date().toLocaleDateString('es-VE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {invoice.viewCount !== undefined && invoice.viewCount > 0 && (
            <p className="mt-2 text-xs">
              Esta factura ha sido vista {invoice.viewCount}{' '}
              {invoice.viewCount === 1 ? 'vez' : 'veces'}
            </p>
          )}
        </div>
      </div>

      {/* Dialog QR Code */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Código QR para Compartir</DialogTitle>
            <DialogDescription>
              Escanea este código para acceder a la factura
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {currentUrl && (
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={currentUrl} size={256} />
              </div>
            )}
            <p className="mt-4 text-sm text-gray-600 text-center break-all">
              {currentUrl}
            </p>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(currentUrl);
                alert('URL copiada al portapapeles');
              }}
              variant="outline"
              className="mt-4"
            >
              Copiar URL
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
