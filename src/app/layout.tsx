import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Front Row Upgrade Queue",
  description: "A fair queue for front-row ticket upgrades.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
