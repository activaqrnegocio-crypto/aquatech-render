import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Aquatech CRM — Innovación Hidráulica",
  description: "Sistema de gestión y seguimiento de proyectos en campo para Aquatech Loja",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aquatech CRM",
  },
  formatDetection: {
    telephone: false,
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <head />
      <body>
        <SessionWrapper>
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
