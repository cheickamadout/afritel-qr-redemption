import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AFRITEL QR Redemption',
  description: 'QR code batch management and redemption dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
