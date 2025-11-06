import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M3W - Next.js Full-Stack App",
  description: "Production-grade web application built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
