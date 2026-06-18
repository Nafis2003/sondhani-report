import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const isValid = email === ADMIN_EMAIL && password === ADMIN_PASSWORD;

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!JWT_SECRET) {
      return NextResponse.json(
        { success: false, error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({ success: true });
    
    // Set cookie
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
