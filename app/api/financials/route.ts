import { NextResponse } from 'next/server';
import { fetchDartReport, fetchDartReportAll, fetchShareholders, buildFinancialMetrics } from '@/utils/dart_api';
import { getNaverStockInfo } from '@/utils/price_api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const corpCode = searchParams.get('corp_code');
  const stockCode = searchParams.get('stock_code') || '';
  const yearsCount = parseInt(searchParams.get('years') || '3', 10);
  const unit = searchParams.get('unit') || 'year';

  if (!corpCode) {
    return NextResponse.json({ error: "기업코드가 누락되었습니다." }, { status: 400 });
  }

  const apiKey = process.env.DART_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: "API 키가 셋팅되지 않았습니다." }, { status: 500 });
  }

  const currentYear = new Date().getFullYear();
  const baseYear = currentYear - 1;

  const targetPeriods: { year: string; reprtCode: string; label: string }[] = [];
  for (let y = baseYear; y > baseYear - yearsCount; y--) {
    const yStr = y.toString();
    if (unit === 'year') {
      targetPeriods.push({ year: yStr, reprtCode: '11011', label: `${yStr}년 연간` });
    } else if (unit === 'quarter') {
      targetPeriods.push({ year: yStr, reprtCode: '11011', label: `${yStr}년 4Q` });
      targetPeriods.push({ year: yStr, reprtCode: '11014', label: `${yStr}년 3Q` });
      targetPeriods.push({ year: yStr, reprtCode: '11012', label: `${yStr}년 반기` });
      targetPeriods.push({ year: yStr, reprtCode: '11013', label: `${yStr}년 1Q` });
    }
  }

  try {
    const naverStockInfo = await getNaverStockInfo(stockCode);

    const promises = targetPeriods.map(async (period) => {
      // 1. 요약 재무제표
      const rawReport = await fetchDartReport(corpCode, period.year, period.reprtCode, apiKey);
      
      // 2. 전체 재무제표 (현금/Net Cash 용) - 분기별로도 활성화
      const allReport = await fetchDartReportAll(corpCode, period.year, period.reprtCode, apiKey);
        
      // 3. 해당 시점의 지분구조 - 분기별로도 활성화
      const hyslrList = await fetchShareholders(corpCode, period.year, period.reprtCode, apiKey);

      return buildFinancialMetrics(rawReport, allReport, hyslrList, period.label, period.year, period.reprtCode, naverStockInfo);
    });

    const results = await Promise.all(promises);
    return NextResponse.json({ 
      data: results, 
      currentLive: {
        price: naverStockInfo.currentClosePrice ? naverStockInfo.currentClosePrice.toLocaleString('ko-KR') + '원' : '-',
        marketCap: naverStockInfo.currentMarketCapText,
        per: naverStockInfo.currentPerText
      }
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "다차원 데이터 수집에 실패했습니다." }, { status: 500 });
  }
}
