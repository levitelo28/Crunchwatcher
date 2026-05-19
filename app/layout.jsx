import "./globals.css";

export const metadata = {
  title: "Crunch Watcher",
  description: "A 30-day health accountability tracker",
  manifest: "/manifest.json",
  applicationName: "Crunch Watcher",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Crunch Watcher"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F1EA"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
