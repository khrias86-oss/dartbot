/**
 * Naver Finance API 연동: 실시간 주가 및 과거 연말 종가를 '제무비율 역산' 기법으로 추출합니다.
 */
export interface NaverStockInfo {
  currentClosePrice: number | null;
  currentMarketCapText: string;
  currentPerText: string;
  totalShares: number | null; // 현재 발행주식수 (시총 / 종가로 역산)
  annualData: {
    [yearYYYY: string]: {
      historicalClosePrice: number | null; // 해당 연도별 마지막 장 마감 종가
      historicalMarketCap: number | null;  // 해당 연도별 종가 기준 시가총액
    }
  };
  quarterlyData: {
    [yearMonth: string]: {
      historicalClosePrice: number | null; 
      historicalMarketCap: number | null;
    }
  };
}

function parseKoreanToNumber(koreanStr: string): number {
  if (!koreanStr) return 0;
  const t = koreanStr.replace(/,/g, '');
  let val = 0;
  // 예: "21조 3,600억"
  const joMatch = t.match(/([\d\.]+)조/);
  const ukMatch = t.match(/([\d\.]+)억/);
  if (joMatch) val += parseFloat(joMatch[1]) * 1000000000000;
  if (ukMatch) val += parseFloat(ukMatch[1]) * 100000000;
  if (!joMatch && !ukMatch) return parseFloat(t) || 0;
  return Math.round(val);
}

export async function getNaverStockInfo(stockCode: string): Promise<NaverStockInfo> {
  const result: NaverStockInfo = { 
    currentClosePrice: null, 
    currentMarketCapText: '-', 
    currentPerText: '-', 
    totalShares: null,
    annualData: {},
    quarterlyData: {}
  };
  
  if (!stockCode || stockCode.trim() === '') return result;

  try {
    // 1. Basic 연동: 현재 종가 확보
    const basicRes = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/basic`);
    if (basicRes.ok) {
      const basicData = await basicRes.json();
      if (basicData.closePrice) {
        result.currentClosePrice = parseFloat(basicData.closePrice.replace(/,/g, ''));
      }
    }

    // 2. Integration 연동: 시가총액, PER 확보
    const intRes = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/integration`);
    let currentMarketCapValue = 0;
    
    if (intRes.ok) {
      const intData = await intRes.json();
      if (intData.totalInfos && Array.isArray(intData.totalInfos)) {
        for (const item of intData.totalInfos) {
          if (item.code === 'marketValue') {
            result.currentMarketCapText = item.value;
            currentMarketCapValue = parseKoreanToNumber(item.value);
          }
          if (item.code === 'per') result.currentPerText = item.value;
        }
      }
    }

    // 현재 상장주식수 역산 도출 (현재 시총 / 현재 종가)
    if (currentMarketCapValue > 0 && result.currentClosePrice && result.currentClosePrice > 0) {
      result.totalShares = currentMarketCapValue / result.currentClosePrice;
    }

    // 3. Annual 연동: (핵심 로직) Naver의 연간 재무제표 중 EPS와 PER을 곱하여 과거 연도말 종가를 소급(역산)합니다.
    const annRes = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/finance/annual`);
    if (annRes.ok) {
      const annData = await annRes.json();
      if (annData?.financeInfo?.rowList) {
        const epsRow = annData.financeInfo.rowList.find((r: any) => r.title === 'EPS');
        const perRow = annData.financeInfo.rowList.find((r: any) => r.title === 'PER');
        
        if (epsRow?.columns && perRow?.columns) {
          for (const key of Object.keys(epsRow.columns)) {
            const yearStr = key.substring(0, 4); // "2024"
            const epsStr = epsRow.columns[key]?.value;
            const perStr = perRow.columns[key]?.value;
            if (!result.annualData[yearStr]) result.annualData[yearStr] = { historicalClosePrice: null, historicalMarketCap: null };
            if (epsStr && epsStr !== '-' && perStr && perStr !== '-') {
              const epsVal = parseFloat(epsStr.replace(/,/g, ''));
              const perVal = parseFloat(perStr.replace(/,/g, ''));
              const historicClose = Math.round(epsVal * perVal);
              result.annualData[yearStr].historicalClosePrice = historicClose;
              if (result.totalShares) result.annualData[yearStr].historicalMarketCap = Math.round(historicClose * result.totalShares);
            }
          }
        }
      }
    }

    // 4. [NEW] Quarterly 연동: 분기별 종가 역산
    const qRes = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/finance/quarter`);
    if (qRes.ok) {
      const qData = await qRes.json();
      if (qData?.financeInfo?.rowList) {
        const epsRow = qData.financeInfo.rowList.find((r: any) => r.title === 'EPS');
        const perRow = qData.financeInfo.rowList.find((r: any) => r.title === 'PER');
        
        if (epsRow?.columns && perRow?.columns) {
          for (const key of Object.keys(epsRow.columns)) {
            // key: "202403", "202406", "202409", "202412"
            const epsStr = epsRow.columns[key]?.value;
            const perStr = perRow.columns[key]?.value;
            if (!result.quarterlyData[key]) result.quarterlyData[key] = { historicalClosePrice: null, historicalMarketCap: null };
            if (epsStr && epsStr !== '-' && perStr && perStr !== '-') {
              const epsVal = parseFloat(epsStr.replace(/,/g, ''));
              const perVal = parseFloat(perStr.replace(/,/g, ''));
              const historicClose = Math.round(epsVal * perVal);
              result.quarterlyData[key].historicalClosePrice = historicClose;
              if (result.totalShares) result.quarterlyData[key].historicalMarketCap = Math.round(historicClose * result.totalShares);
            }
          }
        }
      }
    }

  } catch (error) {
    console.error(`[Naver API] ${stockCode} 주가/과거종가 수집 에러`, error);
  }
  
  return result;
}
