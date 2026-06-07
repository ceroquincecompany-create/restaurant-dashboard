import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'SOFI | Panel de Gestión',
  description: 'Panel de gestión SOFI Pinomonotano',
  icons: {
    icon: '/SOFI LOGO PEQUEÑO S.png',
    apple: '/SOFI LOGO PEQUEÑO S.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className={`${geist.className} bg-white min-h-screen`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}