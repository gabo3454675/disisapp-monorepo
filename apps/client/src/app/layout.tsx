import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistema de Facturación - Disis Corp',
  description: 'Sistema de Facturación Multi-tenant SaaS B2B para gestión de inventario, facturas y gastos',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Facturación',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'application-name': 'Facturación',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Facturación',
    'format-detection': 'telephone=no',
    'msapplication-TileColor': '#3b82f6',
    'msapplication-tap-highlight': 'no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#3b82f6',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const apiUrl =
    typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : 'http://localhost:3001/api';
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__NEXT_PUBLIC_API_URL__=${JSON.stringify(apiUrl)};`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var k='disis-theme';try{var v=localStorage.getItem(k);if(v){var s=JSON.parse(v);if(s&&s.state&&s.state.theme==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.classList.remove('dark');}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
