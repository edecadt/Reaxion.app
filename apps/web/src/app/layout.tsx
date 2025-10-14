"use client";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname } from "next/navigation";

import "./globals.css";
import Navbar from "../components/Navbar";
import { ThemeProvider } from "../components/theme/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isBuilderPage = pathname === "/workflows/builder";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Reaxion.app</title>
        <meta
          name="description"
          content="Automate your world with beautiful actions and reactions."
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}
      >
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            {!isBuilderPage && <Navbar />}
            {isBuilderPage ? (
              children
            ) : (
              <main className="flex flex-1 justify-center px-4 py-8">
                <div className="w-full max-w-5xl">{children}</div>
              </main>
            )}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
