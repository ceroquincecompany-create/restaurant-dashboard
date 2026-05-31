import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard Restaurantes",
  description: "Gestión de locales y KPIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className={`${geist.className} bg-white min-h-screen`}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-60 min-h-screen">{children}</main>
        </div>
      </body>
    </html>
  );
}
