'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OTP } from 'otplib';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from '@/lib/config/api-config';

type WalletSession = {
  companyId: string;
  nationalId: string;
  clientId: string;
  name: string;
  balance: number;
  qrSecret: string;
};

type SearchClientResponse = {
  client: {
    id: string;
    companyId: string;
    nationalId: string;
    name: string;
    balance: number;
    qrSecret: string;
  };
};

const WALLET_SESSION_KEY = 'disis_client_wallet_session';
const TOTP_STEP_SECONDS = 60;

function toBase64Url(content: string): string {
  if (typeof window === 'undefined') return '';
  return btoa(content).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ClienteMonederoContent() {
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [session, setSession] = useState<WalletSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    const queryCompanyId = searchParams.get('companyId') ?? '';
    const queryNationalId = searchParams.get('nationalId') ?? '';
    if (queryCompanyId) setCompanyId(queryCompanyId);
    if (queryNationalId) setNationalId(queryNationalId);
  }, [searchParams]);

  useEffect(() => {
    const saved = localStorage.getItem(WALLET_SESSION_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as WalletSession;
      setSession(parsed);
      setCompanyId(parsed.companyId);
      setNationalId(parsed.nationalId);
    } catch {
      localStorage.removeItem(WALLET_SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsRemaining = useMemo(() => {
    const currentEpochSeconds = Math.floor(now / 1000);
    return TOTP_STEP_SECONDS - (currentEpochSeconds % TOTP_STEP_SECONDS);
  }, [now]);

  useEffect(() => {
    if (!session) return;
    const otp = new OTP({ strategy: 'hotp' });
    const counter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
    otp.generate({ secret: session.qrSecret, counter })
      .then((code) => setOtpCode(code))
      .catch(() => setOtpCode(''));
  }, [session, now]);

  const dynamicQrToken = useMemo(() => {
    if (!session || !otpCode) return null;
    const payload = {
      companyId: session.companyId,
      nationalId: session.nationalId,
      clientId: session.clientId,
      code: otpCode,
      iat: Math.floor(now / 1000),
    };
    return toBase64Url(JSON.stringify(payload));
  }, [session, otpCode, now]);

  const handleAccess = useCallback(async () => {
    if (!companyId || !nationalId) {
      setError('Debes ingresar companyId y nationalId.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/dispatch/search-by-national-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'PUNTO_RETIRO',
        },
        body: JSON.stringify({ companyId, nationalId }),
      });

      if (!response.ok) {
        throw new Error('No se pudo validar el cliente en esa empresa.');
      }

      const data = (await response.json()) as SearchClientResponse;
      const nextSession: WalletSession = {
        companyId: data.client.companyId,
        nationalId: data.client.nationalId,
        clientId: data.client.id,
        name: data.client.name,
        balance: data.client.balance,
        qrSecret: data.client.qrSecret,
      };
      localStorage.setItem(WALLET_SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch {
      setError('No encontramos ese cliente en la empresa indicada.');
    } finally {
      setLoading(false);
    }
  }, [companyId, nationalId]);

  const handleSwitchCompany = useCallback(() => {
    setSession(null);
    setError(null);
    localStorage.removeItem(WALLET_SESSION_KEY);
  }, []);

  if (!session) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Monedero del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingresa con tu cédula y la empresa del local (companyId) para ver tu saldo en esa empresa.
            </p>
            <div className="space-y-2">
              <Label htmlFor="companyId">Company ID</Label>
              <Input
                id="companyId"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="Ej: company_a"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationalId">Cédula / National ID</Label>
              <Input
                id="nationalId"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="Ej: V12345678"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={handleAccess} disabled={loading}>
              {loading ? 'Validando...' : 'Entrar al monedero'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Monedero del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Empresa actual</p>
            <p className="font-semibold">{session.companyId}</p>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium">{session.name}</p>
            <p className="text-sm text-muted-foreground">Saldo disponible</p>
            <p className="text-2xl font-bold">{session.balance.toFixed(2)} pts</p>
          </div>

          <div className="rounded-lg border p-4 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center">
              QR dinámico (se regenera cada 60 segundos)
            </p>
            {dynamicQrToken ? <QRCodeSVG value={dynamicQrToken} size={220} /> : null}
            <p className="text-xs text-muted-foreground">Expira en {secondsRemaining}s</p>
          </div>

          <Button variant="outline" onClick={handleSwitchCompany}>
            Cambiar empresa o cliente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ClienteMonederoPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto p-4 md:p-8">
          <Card>
            <CardHeader>
              <CardTitle>Monedero del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ClienteMonederoContent />
    </Suspense>
  );
}
