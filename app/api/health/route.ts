import { NextResponse } from 'next/server';

// Simple health check endpoint
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
