import yahooFinance from 'yahoo-finance2';

export interface HistoricalPriceResult {
  verifiedPrice: number | null;
  source: 'yahoo' | 'naver' | 'both' | 'none';
  diff?: number; // 두 소스간 차이 (퍼센트)
}

/**
 * Naver Finance API를 통해 특정 날짜의 실제 종가를 가져옵니다.
 */
export async function getNaverHistoricalPrice(stockCode: string, targetDate: string): Promise<number | null> {
  if (!stockCode || stockCode.length !== 6) return null;

  try {
    const target = targetDate.replace(/-/g, ''); // 20231231
    // 타겟 날짜 전후 10일치 데이터를 가져와 마지막 유효 영업일 종가 추출
    const start = new Date(targetDate);
    start.setDate(start.getDate() - 10);
    const startDateStr = start.toISOString().slice(0, 10).replace(/-/g, '');
    
    const url = `https://api.finance.naver.com/siseJson.naver?symbol=${stockCode}&requestType=1&startTime=${startDateStr}&endTime=${target}&timeType=day`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const text = await res.text();
    // Naver 응답 형식: [['날짜',...], ['20231201',...], ...] 코드를 이식하기 쉽게 정제
    const cleanedText = text.replace(/'/g, '"').trim();
    const data = JSON.parse(cleanedText);
    
    if (Array.isArray(data) && data.length > 1) {
      const lastRow = data[data.length - 1];
      const closePrice = parseInt(lastRow[4], 10);
      return isNaN(closePrice) ? null : closePrice;
    }
    return null;
  } catch (e) {
    console.error("Naver Price Fetch Error:", e);
    return null;
  }
}

/**
 * Yahoo Finance에서 실제 종가를 가져옵니다.
 */
export async function getYahooHistoricalPrice(stockCode: string, targetDate: string): Promise<number | null> {
  const target = new Date(targetDate);
  const startDate = new Date(target);
  startDate.setDate(target.getDate() - 10);
  const endDate = new Date(target);
  endDate.setDate(target.getDate() + 1);

  const symbols = [`${stockCode}.KS`, `${stockCode}.KQ`];
  for (const symbol of symbols) {
    try {
      const results = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });
      if (results && results.length > 0) {
        return results[results.length - 1].close || null;
      }
    } catch { continue; }
  }
  return null;
}

/**
 * Yahoo와 Naver 데이터를 교차 검증하여 가장 신뢰도 높은 종가를 반환합니다.
 */
export async function getCrossVerifiedPrice(stockCode: string, targetDate: string): Promise<HistoricalPriceResult> {
  const [yahooPrice, naverPrice] = await Promise.all([
    getYahooHistoricalPrice(stockCode, targetDate),
    getNaverHistoricalPrice(stockCode, targetDate)
  ]);

  if (yahooPrice && naverPrice) {
    const diff = Math.abs(yahooPrice - naverPrice) / Math.max(yahooPrice, naverPrice);
    if (diff < 0.01) { // 1% 미만 차이면 신뢰 (보통 소수점 처리 차이)
      return { verifiedPrice: naverPrice, source: 'both', diff: diff * 100 };
    }
    // 차이가 클 경우 한국 시장 특성상 Naver 데이터를 우선시 (수정주가 반영 방식 차이 방지)
    return { verifiedPrice: naverPrice, source: 'naver', diff: diff * 100 };
  }

  if (naverPrice) return { verifiedPrice: naverPrice, source: 'naver' };
  if (yahooPrice) return { verifiedPrice: yahooPrice, source: 'yahoo' };

  return { verifiedPrice: null, source: 'none' };
}
