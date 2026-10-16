import { NextResponse, type NextRequest } from "next/server";
import { cerrarSesion } from "@/server/auth/login";

export async function POST(request: NextRequest) {
  await cerrarSesion();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
