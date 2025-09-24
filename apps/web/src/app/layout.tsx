import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import Navbar from "../components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reaxion.app",
  description: "Automate your world with beautiful actions and reactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}
      >
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex flex-1 justify-center px-4 py-8">
            <div className="w-full max-w-5xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
