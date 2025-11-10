'use client';

import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { I18nProvider } from "@/components/providers/i18n-provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>
          {children}
        </I18nProvider>
        <Toaster />
      </body>
    </html>
  );
}
