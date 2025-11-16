"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ERROR_MESSAGES } from "./helpers/const";

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
          <h1>{error?.message ?? ERROR_MESSAGES.UNKNOWN_ERROR}</h1>
          <p className="my-8 muted">{ERROR_MESSAGES.UNEXPECTED_ERROR}</p>
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
