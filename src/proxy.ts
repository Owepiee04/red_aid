import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request : NextRequest){
    const token = request.cookies.get('auth_token');
    console.log("pathname")
    console.log(request.nextUrl.pathname);
    const pathname = request.nextUrl.pathname;
    // console.log("proxy.ts!")
    if(pathname == '/login' || pathname =='/signup')
        return NextResponse.next()
    if(!token){
        return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
}

export const config = {
   matcher: [
    // Exclude API routes, static files, image optimizations, and .png files
    '/((?!api|_next/static|_next/image|.*\\.png$).*)',
  ],
}