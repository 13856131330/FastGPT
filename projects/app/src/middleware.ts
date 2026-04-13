import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/dashboard/agent';
  url.search = '';

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/dashboard/templateMarket/:path*',
    '/dashboard/mcpServer/:path*',
    '/dashboard/tool/:path*',
    '/dashboard/systemTool/:path*'
  ]
};
