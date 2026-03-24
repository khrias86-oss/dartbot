import { NextResponse } from 'next/server';
import { searchCompanyByName } from '@/utils/corp_api';

export async function GET(request: Request) {
  // 클라이언트로부터 ?q=삼성전자 형태의 검색 키워드를 받습니다.
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: "검색어를 입력해주세요." }, { status: 400 });
  }

  try {
    // 만들어둔 corp_api의 검색 엔진 가동
    const results = await searchCompanyByName(query);
    
    // 검색 결과를 그대로 배열 형태로 프론트엔드에 리턴
    return NextResponse.json({ data: results });
  } catch (error: any) {
    console.error("회사명 원격 검색 실패:", error);
    return NextResponse.json(
      { error: "회사명 리스트를 초기화하거나 검색하는 중 오류가 발생했습니다. (최초 기동 시 수 초가 소요될 수 있습니다)" },
      { status: 500 }
    );
  }
}
