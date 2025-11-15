"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="app-shell">
      <div className="container">
        <div className="surface text-center">
          <h1>404 — Page not found</h1>
          <p className="my-8 muted">
            We couldn&apos;t find the page you&apos;re looking for.
          </p>

          <div>
            <Link
              href="/"
              className="mt-4 py-1.5 px-3 btn btn-accent font-medium"
            >
              Home
            </Link>

            <button
              type="button"
              onClick={() => router.back()}
              className="ms-4 py-1.5 px-3 btn btn-outline font-medium"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
