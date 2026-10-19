import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Mentoria Board",
  description: "Quadro branco colaborativo para sessões de mentoria",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} style={{ ["--mb-font-sans" as string]: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
