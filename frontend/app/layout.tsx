import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles
import { WalletProvider } from '@/contexts/WalletContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: 'Veilbook built on Midnight',
  description: 'Zero-knowledge block trading on the Midnight Network.',
  openGraph: {
    title: 'Veilbook built on Midnight',
    description: 'Zero-knowledge block trading on the Midnight Network.',
    images: [
      {
        url: '/images/og-image.webp',
        width: 1910,
        height: 934,
        alt: 'Veilbook Landing Page',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veilbook built on Midnight',
    description: 'Zero-knowledge block trading on the Midnight Network.',
    images: ['/images/og-image.webp'],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans bg-black text-white" suppressHydrationWarning>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
