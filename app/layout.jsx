import "./globals.css";

export const metadata = {
  title: "Crunch Watcher",
  description: "A 30-day health accountability tracker"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
