import type { Metadata } from "next";

import { DashboardShell } from "@/components/layout/dashboard-shell";

import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cacsms Nexus",
  description: "AI-Driven Autonomous Institutional Trading Ecosystem"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <DashboardShell>{children}</DashboardShell>
        </AppProviders>
      </body>
    </html>
  );
}
