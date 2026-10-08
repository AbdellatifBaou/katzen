import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Katzen-Feeder | Mimi, Miscu & Luna',
  description: 'Fütterungsplan & Echtzeit-Tracking für unsere 3 Katzen (5 Personen WG)',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Katzen-Feeder',
  },
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐱</text></svg>',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
