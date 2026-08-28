import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.error('Supabase env missing in middleware')
    return NextResponse.next({ request })
  }

  try {
    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { session } } = await supabase.auth.getSession()

    // Protect /admin/* routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      if (!session) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
      }
    }

    // Redirect logged in users away from login page
    if (request.nextUrl.pathname === '/login' && session) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    return supabaseResponse
  } catch (err) {
    console.error('Middleware error:', err)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
  ],
}