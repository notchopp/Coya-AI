import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AuthWrapper from "@/components/AuthWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AccentColorProvider } from "@/components/AccentColorProvider";
import { PremiumModeProvider } from "@/components/PremiumModeProvider";
import { ProgramProvider } from "@/components/ProgramProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "COYA AI - Receptionist Dashboard",
  description: "Live receptionist call monitoring and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* CSP policy - allows Next.js blob URLs and required sources */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; object-src 'none';"
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AccentColorProvider>
            <PremiumModeProvider>
              <ProgramProvider>
                <AuthWrapper>{children}</AuthWrapper>
              </ProgramProvider>
            </PremiumModeProvider>
          </AccentColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
