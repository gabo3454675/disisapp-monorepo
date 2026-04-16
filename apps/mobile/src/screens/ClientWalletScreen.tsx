import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { OTP } from 'otplib';
import QRCode from 'react-native-qrcode-svg';
import { apiClient } from '@/lib/api';

const WALLET_KEY = 'disis_mobile_wallet_session';
const TOKEN_STEP_SECONDS = 60;

type WalletSession = {
  companyId: string;
  nationalId: string;
  clientId: string;
  name: string;
  balance: number;
  qrSecret: string;
};

type WalletMovement = {
  id: string;
  type: 'RECHARGE' | 'CONSUMPTION';
  amount: number;
  createdAt: string;
};

export function ClientWalletScreen() {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [nationalId, setNationalId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [movements, setMovements] = useState<WalletMovement[]>([]);

  useEffect(() => {
    SecureStore.getItemAsync(WALLET_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as WalletSession;
        setSession(parsed);
        setNationalId(parsed.nationalId);
        setCompanyId(parsed.companyId);
      } catch {
        SecureStore.deleteItemAsync(WALLET_KEY).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      try {
        const parsed = new URL(url);
        const qCompanyId = parsed.searchParams.get('companyId') ?? '';
        if (qCompanyId) setCompanyId(qCompanyId);
      } catch {
        // no-op
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = useMemo(() => {
    const balance = session?.balance ?? 0;
    const maxReference = 200;
    return Math.min(100, Math.max(0, (balance / maxReference) * 100));
  }, [session?.balance]);

  const secondsRemaining = useMemo(() => {
    const sec = Math.floor(now / 1000);
    return TOKEN_STEP_SECONDS - (sec % TOKEN_STEP_SECONDS);
  }, [now]);

  const dynamicToken = useMemo(() => {
    if (!session) return '';
    const otp = new OTP({ strategy: 'hotp' });
    const counter = Math.floor(now / 1000 / TOKEN_STEP_SECONDS);
    return otp.generateSync({ secret: session.qrSecret, counter });
  }, [session, now]);

  const qrPayload = useMemo(() => {
    if (!session || !dynamicToken) return '';
    return JSON.stringify({
      clientId: session.clientId,
      companyId: session.companyId,
      nationalId: session.nationalId,
      token: dynamicToken,
      iat: Math.floor(now / 1000),
    });
  }, [session, dynamicToken, now]);

  const fetchLastMovements = useCallback(async (activeCompanyId: string, activeNationalId: string) => {
    try {
      const response = await apiClient.post('/dispatch/manual-search', {
        companyId: activeCompanyId,
        nationalId: activeNationalId,
      });

      const history = (response.data?.consumptionHistory?.lastConsumptions ?? []) as Array<{
        id: string;
        amount: number;
        createdAt: string;
      }>;

      setMovements(
        history.slice(0, 5).map((item) => ({
          id: item.id,
          type: 'CONSUMPTION',
          amount: item.amount,
          createdAt: item.createdAt,
        })),
      );
    } catch {
      setMovements([]);
    }
  }, []);

  const handleLogin = useCallback(async () => {
    if (!nationalId.trim() || !companyId.trim()) {
      setError('Debes ingresar cédula y companyId.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/dispatch/search-by-national-id', {
          companyId: companyId.trim(),
          nationalId: nationalId.trim(),
      });
      const data = response.data as { client: WalletSession & { id: string } };
      const nextSession: WalletSession = {
        companyId: data.client.companyId,
        nationalId: data.client.nationalId,
        clientId: data.client.clientId || data.client.id,
        name: data.client.name,
        balance: data.client.balance,
        qrSecret: data.client.qrSecret,
      };

      await SecureStore.setItemAsync(WALLET_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      await fetchLastMovements(nextSession.companyId, nextSession.nationalId);
    } catch {
      setError('No se pudo abrir tu monedero para esta empresa.');
    } finally {
      setLoading(false);
    }
  }, [companyId, nationalId, fetchLastMovements]);

  const handleLogoutWallet = useCallback(async () => {
    await SecureStore.deleteItemAsync(WALLET_KEY);
    setSession(null);
    setShowQr(false);
    setMovements([]);
  }, []);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Monedero del Cliente</Text>
        <Text style={styles.subtitle}>Ingresa tu cédula y el companyId del local.</Text>
        <TextInput style={styles.input} value={nationalId} onChangeText={setNationalId} placeholder="Cédula" />
        <TextInput style={styles.input} value={companyId} onChangeText={setCompanyId} placeholder="companyId" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? 'Validando...' : 'Entrar'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Monedero del Cliente</Text>
      <Text style={styles.subtitle}>{session.name} · {session.companyId}</Text>

      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { borderColor: '#2563eb' }]}>
          <Text style={styles.balance}>{session.balance.toFixed(2)}</Text>
          <Text style={styles.balanceLabel}>Saldo disponible</Text>
          <Text style={styles.progressText}>{progress.toFixed(0)}%</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => setShowQr((s) => !s)}>
        <Text style={styles.primaryButtonText}>{showQr ? 'Ocultar QR dinámico' : 'Generar QR dinámico'}</Text>
      </TouchableOpacity>

      {showQr && qrPayload ? (
        <View style={styles.qrCard}>
          <QRCode value={qrPayload} size={200} />
          <Text style={styles.small}>Token: {dynamicToken}</Text>
          <Text style={styles.small}>Expira en {secondsRemaining}s</Text>
        </View>
      ) : null}

      <View style={styles.movementsCard}>
        <Text style={styles.sectionTitle}>Últimos 5 movimientos en este negocio</Text>
        {movements.length === 0 ? (
          <Text style={styles.small}>No hay movimientos recientes.</Text>
        ) : (
          movements.map((mv) => (
            <View key={mv.id} style={styles.row}>
              <Text style={styles.rowType}>{mv.type === 'CONSUMPTION' ? 'Retiro' : 'Recarga'}</Text>
              <Text style={styles.rowAmount}>{mv.amount.toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={handleLogoutWallet}>
        <Text style={styles.secondaryButtonText}>Cambiar empresa / cliente</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: '#f5f5f5', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16, textAlign: 'center' },
  input: { width: '100%', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
  error: { color: '#dc2626', marginBottom: 8 },
  primaryButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, marginTop: 4 },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  progressOuter: { width: 220, height: 220, borderRadius: 110, borderWidth: 8, borderColor: '#bfdbfe', justifyContent: 'center', alignItems: 'center', marginVertical: 16 },
  progressInner: { width: 180, height: 180, borderRadius: 90, borderWidth: 6, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  balance: { fontSize: 30, fontWeight: '700', color: '#111' },
  balanceLabel: { fontSize: 12, color: '#666' },
  progressText: { marginTop: 4, fontSize: 12, color: '#2563eb', fontWeight: '600' },
  qrCard: { marginTop: 16, backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  movementsCard: { marginTop: 16, backgroundColor: '#fff', padding: 16, borderRadius: 12, width: '100%' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#111' },
  small: { fontSize: 12, color: '#666', marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  rowType: { color: '#111' },
  rowAmount: { color: '#111', fontWeight: '600' },
  secondaryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 14 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
});
