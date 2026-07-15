import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    const expectedPassword = process.env.ADMIN_PASSWORD || 'ocean22';
    let isValid = false;

    if (isSupabaseConfigured && supabase) {
      try {
        // Query the admin_auth table
        let { data, error } = await supabase
          .from('admin_auth')
          .select('password_hash')
          .eq('email', 'won2020@ocean.ms.kr')
          .single();

        // If the table exists but the admin record does not exist
        if (error && error.code === 'PGRST116') {
          const defaultHash = hashPassword('ocean22');
          const { error: insertError } = await supabase
            .from('admin_auth')
            .insert({ email: 'won2020@ocean.ms.kr', password_hash: defaultHash });
          
          if (!insertError) {
            data = { password_hash: defaultHash };
          }
        }

        if (data && data.password_hash) {
          const incomingHash = hashPassword(password);
          isValid = incomingHash === data.password_hash;
        } else {
          // If table query fails, fallback to local env setup
          isValid = password === expectedPassword;
        }
      } catch (dbErr) {
        console.warn('Database auth check failed, falling back to local env password:', dbErr);
        isValid = password === expectedPassword;
      }
    } else {
      isValid = password === expectedPassword;
    }

    if (isValid) {
      const response = NextResponse.json({ success: true, message: '인증에 성공했습니다.' });
      
      const cookieStore = await cookies();
      cookieStore.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, message: '비밀번호가 올바르지 않습니다.' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session')?.value;

  if (session === 'authenticated') {
    return NextResponse.json({ authenticated: true });
  }

  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: '로그아웃 되었습니다.' });
  
  // Clear cookie
  response.cookies.set('admin_session', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
