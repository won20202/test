import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = await request.json();

    // 1. Verify Supabase configuration
    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json(
        { success: false, message: '수파베이스 클라우드가 연동되지 않은 로컬 모드에서는 비밀번호를 변경할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2. Extract and verify Supabase JWT token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: '구글 로그인 인증 토큰이 유효하지 않거나 없습니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    // Validate the token against Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: '구글 세션이 만료되었거나 인증할 수 없습니다.' },
        { status: 401 }
      );
    }

    // Check if the authenticated user's email is exactly won2020@ocean.ms.kr
    if (user.email !== 'won2020@ocean.ms.kr') {
      return NextResponse.json(
        { success: false, message: '비밀번호를 변경할 권한이 없는 구글 계정입니다. 관리자 계정(won2020@ocean.ms.kr)으로 로그인하세요.' },
        { status: 403 }
      );
    }

    // 3. Fetch current passcode hash from Supabase database
    let { data, error } = await supabase
      .from('admin_auth')
      .select('password_hash')
      .eq('email', 'won2020@ocean.ms.kr')
      .single();

    // If the table exists but no record, create the default one
    if (error && error.code === 'PGRST116') {
      const defaultHash = hashPassword('ocean22');
      const { error: insertError } = await supabase
        .from('admin_auth')
        .insert({ email: 'won2020@ocean.ms.kr', password_hash: defaultHash });
      
      if (!insertError) {
        data = { password_hash: defaultHash };
      }
    } else if (error) {
      return NextResponse.json(
        { success: false, message: '데이터베이스 조회 실패. admin_auth 테이블이 정상 생성되었는지 확인하십시오.' },
        { status: 500 }
      );
    }

    if (!data || !data.password_hash) {
      return NextResponse.json(
        { success: false, message: '관리자 기존 비밀번호 해시 데이터를 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 4. Validate current password
    const currentHash = hashPassword(currentPassword);
    if (currentHash !== data.password_hash) {
      return NextResponse.json(
        { success: false, message: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    // 5. Update hash to new password
    const newHash = hashPassword(newPassword);
    const { error: updateError } = await supabase
      .from('admin_auth')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('email', 'won2020@ocean.ms.kr');

    if (updateError) {
      return NextResponse.json(
        { success: false, message: '비밀번호 업데이트 중 오류가 발생했습니다: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: '비밀번호 변경 중 서버 내부 오류가 발생했습니다.', error: error.message },
      { status: 500 }
    );
  }
}
