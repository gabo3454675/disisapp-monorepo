import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { ClientWalletScreen } from '@/screens/ClientWalletScreen';

const Stack = createNativeStackNavigator();

/**
 * Navegación: solo se muestra Login cuando no hay token o el token es inválido (401).
 * La sesión es persistente (SecureStore) y nunca expira por inactividad.
 * Redirigir a Login únicamente cuando:
 * - Al iniciar, no hay token en SecureStore.
 * - Al iniciar, el token devuelve 401 al validar con el backend.
 * - El usuario pulsa "Cerrar sesión".
 */
function AppNavigator() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: true }}
      initialRouteName={isAuthenticated ? 'Home' : 'Login'}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Disis' }}
          />
          <Stack.Screen
            name="ClientWallet"
            component={ClientWalletScreen}
            options={{ title: 'Monedero del Cliente' }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Iniciar sesión', headerBackVisible: false }}
        />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
