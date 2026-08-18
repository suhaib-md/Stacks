import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

/**
 * One family, two voices. Archivo is variable on the width axis, so the
 * "expanded" display cut is the same font widened rather than a second
 * download — see the `.disp` / `.font-display` rules in globals.css.
 */
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Stacks",
  description: "Your personal book catalog.",
  applicationName: "Stacks",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f2f2" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applies the stored theme before first paint. Without this the page renders in
 * the system theme for a frame before the manual override lands — the classic
 * dark-mode flash.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var t = localStorage.getItem('stacks-theme');
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
