import { Bodoni_Moda, Outfit } from 'next/font/google';
import './globals.css';

// Logodan: "Lounge" yüksek kontrastlı Didone -> Bodoni Moda; "iron" yuvarlak tek çizgi -> Outfit
const serif = Bodoni_Moda({
  subsets: ['latin', 'latin-ext'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap',
});
const sans = Outfit({
  subsets: ['latin', 'latin-ext'], variable: '--font-sans', display: 'swap',
});

export const metadata = {
  title: 'Iron Lounge Mesai',
  icons: { icon: '/logo-dark.png', apple: '/logo-dark.png' },
  appleWebApp: { capable: true, title: 'Iron Lounge', statusBarStyle: 'default' },
};

export const viewport = { themeColor: '#ffffff' };

export default function RootLayout({ children }) {
  return (
    <html lang="tr" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
