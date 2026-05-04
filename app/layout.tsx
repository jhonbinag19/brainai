// Minimal App Router layout — exists only to satisfy Next.js for app/api/* routes.
// The actual UI lives in pages/ (Pages Router) which has no MetadataTree hydration issues.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
