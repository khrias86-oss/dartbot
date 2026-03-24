import { NextResponse } from 'next/server';
import { fetchDartReport, fetchDartReportAll, fetchShareholders, fetchStockTotalQuantity, buildFinancialMetrics } from '@/utils/dart_api';
import { getNaverStockInfo } from '@/utils/price_api';
import { getCrossVerifiedPrice } from '@/utils/historical_price_api';

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

  const targetPeriods: { year: string; reprtCode: string; label: string; date: string }[] = [];
  for (let y = baseYear; y > baseYear - yearsCount; y--) {
    const yStr = y.toString();
    if (unit === 'year') {
      targetPeriods.push({ year: yStr, reprtCode: '11011', label: `${yStr}년 연간`, date: `${yStr}-12-31` });
    } else if (unit === 'quarter') {
      targetPeriods.push({ year: yStr, reprtCode: '11011', label: `${yStr}년 4Q`, date: `${yStr}-12-31` });
      targetPeriods.push({ year: yStr, reprtCode: '11014', label: `${yStr}년 3Q`, date: `${yStr}-09-30` });
      targetPeriods.push({ year: yStr, reprtCode: '11012', label: `${yStr}년 반기`, date: `${yStr}-06-30` });
      targetPeriods.push({ year: yStr, reprtCode: '11013', label: `${yStr}년 1Q`, date: `${yStr}-03-31` });
    }
  }

  try {
    const naverStockInfo = await getNaverStockInfo(stockCode);

    const promises = targetPeriods.map(async (period) => {
      // 1. DART 데이터 (요약/전체/지분/주식수)
      const [rawReport, allReport, hyslrList, totalShares] = await Promise.all([
        fetchDartReport(corpCode, period.year, period.reprtCode, apiKey),
        fetchDartReportAll(corpCode, period.year, period.reprtCode, apiKey),
        fetchShareholders(corpCode, period.year, period.reprtCode, apiKey),
        fetchStockTotalQuantity(corpCode, period.year, period.reprtCode, apiKey)
      ]);

      // 2. 외부 시세 검증 (Yahoo + Naver 교차)
      const priceResult = await getCrossVerifiedPrice(stockCode, period.date);

      return buildFinancialMetrics(
        rawReport, 
        allReport, 
        hyslrList, 
        period.label, 
        period.year, 
        period.reprtCode, 
        naverStockInfo, 
        priceResult.verifiedPrice,
        totalShares
      );
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
