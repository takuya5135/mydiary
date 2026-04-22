import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request: Request) {
  try {
    const { code, redirectUri } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri // クライアント側から渡されたリダイレクトURIを使用
    );

    // Authorization code を Token に交換
    const { tokens } = await oauth2Client.getToken(code);
    
    return NextResponse.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    }, { status: 200 });

  } catch (error: any) {
    console.error("POST /api/auth/exchange error:", error);
    return NextResponse.json(
      { error: "Failed to exchange authorization code", details: error.message },
      { status: 500 }
    );
  }
}
