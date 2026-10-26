import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import OfflineDatabaseInitializer from "@/lib/indexed-db/OfflineDatabaseInitializer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RedAid",
  description: "Digital patient care reports for VSU College Red Cross Youth duties",
  appleWebApp: { capable: true, title: "RedAid", statusBarStyle: "default" },
};

// Colors the phone's status bar / browser toolbar Red Cross red, and lets the
// bottom tab bar sit above the iPhone home indicator (viewport-fit=cover).
export const viewport: Viewport = {
  themeColor: "#ed1c24",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} min-h-screen font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <OfflineDatabaseInitializer />
        <Toaster />
      </body>
    </html>
  );
}
