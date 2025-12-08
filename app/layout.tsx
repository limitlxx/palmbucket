import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@rainbow-me/rainbowkit/styles.css';
import { Providers } from "@/components/providers/WagmiProvider";
import { GestureController } from "@/components/gesture/GestureController";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PalmBudget - Gesture-Controlled Budgeting",
  description: "Automatically split cryptocurrency payments into yield-bearing buckets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <GestureController />
          {children}
        </Providers>
      </body>
    </html>
  );
}
