import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Italiana } from "next/font/google"
import { AuthProvider } from "@/contexts/AuthContext";
const italianaFont = Italiana({
    weight : "400",
});
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luminary",
  description: "An MVP for a community-centered E-Book streaming/publishing service",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
        <head>
          {/* <link rel="preconnect" href="https://fonts.googleapis.com"/>
          <link rel="preconnect" href="https://fonts.gstatic.com"/>
          <link href="https://fonts.googleapis.com/css2?family=Italiana&display=swap" rel="stylesheet"/> */}
        </head>
        <AuthProvider>
        <body>
            {children}
        </body>
        </AuthProvider>
        
    </html>
  );
}