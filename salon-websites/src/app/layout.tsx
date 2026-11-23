import React from 'react';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Salon Website | Dart Smart Salon',
  description: 'Official salon website powered by Dart Smart Salon SaaS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen flex flex-col antialiased bg-white text-slate-900">
        {children}
      </body>
    </html>
  );
}

