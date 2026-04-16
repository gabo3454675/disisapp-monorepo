import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';

export function HomeScreen() {
  const { user, clearAuth } = useAuth();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        Hola, {user?.fullName || user?.email || 'Usuario'}
      </Text>
      <Text style={styles.info}>
        Sesión persistente: no expira por inactividad. Solo se cierra al cerrar sesión o si el token es inválido.
      </Text>
      <TouchableOpacity style={styles.walletButton} onPress={() => navigation.navigate('ClientWallet')}>
        <Text style={styles.walletText}>Abrir Monedero Cliente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={clearAuth}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  welcome: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    lineHeight: 20,
  },
  logoutButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  walletButton: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    marginBottom: 12,
  },
  walletText: {
    color: '#1d4ed8',
    fontSize: 16,
    fontWeight: '600',
  },
});
