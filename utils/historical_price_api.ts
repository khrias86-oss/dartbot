import yahooFinance from 'yahoo-finance2';

export interface HistoricalPrice {
  date: string;
  close: number | null;
  marketCap: number | null;
}

/**
 * 특정 날짜에 인접한 실제 종가를 Yahoo Finance에서 가져옵니다.
 * @param stockCode 6자리 종목코드
 * @param targetDate ISO 날짜 문자열 (예: 2023-12-31)
 */
export async function getVerifiedHistoricalPrice(stockCode: string, targetDate: string): Promise<number | null> {
  if (!stockCode || stockCode.length !== 6) return null;

  const target = new Date(targetDate);
  // 검색 범위: 타겟 날짜로부터 7일 전까지 (공휴일 고려)
  const startDate = new Date(target);
  startDate.setDate(target.getDate() - 7);
  
  const endDate = new Date(target);
  endDate.setDate(target.getDate() + 1); // 타겟 날짜 당일 포함

  const symbols = [`${stockCode}.KS`, `${stockCode}.KQ`];
  
  for (const symbol of symbols) {
    try {
      const results = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d'
      });

      if (results && results.length > 0) {
        // 결과 중 타겟 날짜와 가장 가깝거나 이전인 마지막 데이터 반환
        const lastData = results[results.length - 1];
        return lastData.close || null;
      }
    } catch (e) {
      // 심볼이 틀릴 경우 (KS -> KQ) 계속 진행
      continue;
    }
  }

  return null;
}

/**
 * 특정 시점의 시가총액을 역산하거나 가져오기 위해 상장주식수를 확보합니다.
 * (Yahoo Finance의 quoteSummary 사용)
 */
export async function getSharesOutstanding(stockCode: string): Promise<number | null> {
  const symbols = [`${stockCode}.KS`, `${stockCode}.KQ`];
  for (const symbol of symbols) {
    try {
      const summary = await yahooFinance.quoteSummary(symbol, {
        modules: ['defaultKeyStatistics']
      });
      return summary.defaultKeyStatistics?.sharesOutstanding || null;
    } catch (e) {
      continue;
    }
  }
  return null;
}
