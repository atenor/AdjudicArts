import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4 pt-2">
          <Link
            href="/dashboard"
            className="text-sm text-primary underline underline-offset-4"
          >
            Go to dashboard
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href="/login"
            className="text-sm text-primary underline underline-offset-4"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
