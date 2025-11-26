import { NextResponse } from "next/server";

export const config = {
  matcher: ["/db-viewer.html"],
};

export function proxy() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}
