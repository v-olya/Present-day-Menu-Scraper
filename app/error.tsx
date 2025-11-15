"use client";
import { useEffect } from "react";
import Link from "next/link";

type Props = {
  error: Error;
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-shell">
      <div className="container">
        <div className="surface text-center">
          <h1>{error?.message ?? "Unknown error"}</h1>
          <p className="my-8 muted">
            An unexpected error occurred. Try again, go back, or go home.
          </p>
          <div>
            <Link href="/" className="py-1.5 px-3 btn btn-accent font-medium">
              Home
            </Link>

            <button
              type="button"
              onClick={() => reset()}
              className="ms-4 py-1.5 px-3 btn btn-outline font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
