import { NaverStockInfo } from './price_api';

export interface DartFinancialData {
  corp_code: string;
  bsns_year: string;
  reprt_code: string;
  account_nm: string;
  thstrm_amount: string; 
}

export interface Shareholder {
  nm: string;
  relate: string;
  stock_knd: string;
  bsis_posesn_stock_co: string;
  bsis_posesn_stock_qota_rt: string;
  trmend_posesn_stock_co: string;
  trmend_posesn_stock_qota_rt: string;
}

export interface AdvancedFinancialMetrics {
  periodLabel: string; 
  매출액: string;
  영업이익: string;
  당기순이익: string;
  자산총계: string;
  부채총계: string;
  자본총계: string;
  부채비율: string; 
  영업이익률: string; 
  // [NetCash 완벽 부활] 
  현금및현금성자산: string;
  단기차입금: string;
  NetCash: string;
  // [지분 구조]
  주요주주목록: string[];
  // [과거 타임머신 종가 부활]
  해당연도종가: string; 
  해당연도시가총액: string;
  해당연도PER: string; 
}

// 1. DART 요약 재무제표 (기본 지표용)
export async function fetchDartReport(corpCode: string, year: string, reprtCode: string, apiKey: string): Promise<DartFinancialData[]> {
  try {
    const res = await fetch(`https://opendart.fss.or.kr/api/fnlttSinglAcnt.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprtCode}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.status === '000' && Array.isArray(json.list) ? json.list : []; 
  } catch { return []; }
}

// 2. DART 전체 재무제표 (Net Cash 현금/차입금 전용)
export async function fetchDartReportAll(corpCode: string, year: string, reprtCode: string, apiKey: string): Promise<DartFinancialData[]> {
  try {
    const res = await fetch(`https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprtCode}&fs_div=CFS`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.status === '000' && Array.isArray(json.list) ? json.list : []; 
  } catch { return []; }
}

// 3. DART 지분구조 현황 (최대주주)
export async function fetchShareholders(corpCode: string, year: string, reprtCode: string, apiKey: string): Promise<Shareholder[]> {
  try {
    const res = await fetch(`https://opendart.fss.or.kr/api/hyslrSttus.json?crtfc_key=${apiKey}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprtCode}`);
    if (!res.ok) return [];
    const json = await res.json();
    // 상위 5인 이내 등 묶음 처리 방지
    return json.status === '000' && Array.isArray(json.list) ? json.list : []; 
  } catch { return []; }
}

function extractAmount(data: DartFinancialData[], keywords: string[]): number | null {
  for (const item of data) {
    if (!item.account_nm) continue;
    for (const keyword of keywords) {
      if (item.account_nm.includes(keyword)) {
        const val = parseFloat(item.thstrm_amount.replace(/,/g, ''));
        if (!isNaN(val)) return val;
      }
    }
  }
  return null;
}

export function buildFinancialMetrics(
  rawData: DartFinancialData[], // 요약 재무제표
  allData: DartFinancialData[], // 전체 재무제표 (현금/차입금 용도)
  shareholders: Shareholder[],  // 해당 연도/분기의 지분 구조
  periodLabel: string,
  yearStr: string,
  reprtCode: string, // [추가] 분기 구분을 위해 필요
  naverStockInfo: NaverStockInfo
): AdvancedFinancialMetrics {
  
  const 매출액 = extractAmount(rawData, ['매출액', '영업수익']) || 0;
  const 영업이익 = extractAmount(rawData, ['영업이익']) || 0;
  const 당기순이익 = extractAmount(rawData, ['당기순이익', '연결당기순이익']) || 0;
  const 자산총계 = extractAmount(rawData, ['자산총계']) || 0;
  const 부채총계 = extractAmount(rawData, ['부채총계']) || 0;
  const 자본총계 = extractAmount(rawData, ['자본총계']) || 0;
  
  const 부채비율 = 자본총계 !== 0 ? ((부채총계 / 자본총계) * 100).toFixed(2) + '%' : '-';
  const 영업이익률 = 매출액 !== 0 ? ((영업이익 / 매출액) * 100).toFixed(2) + '%' : '-';

  // [수정핵심] 전체 재무제표에서 드디어 Net 현금/차입금을 뼛속까지 발라냅니다.
  const 현금성자산 = extractAmount(allData, ['현금및현금성자산', '현금 및 현금성 자산']);
  const 단기차입금 = extractAmount(allData, ['단기차입금', '유동성단기차입금', '유동성장기부채']);

  const fmt = (num: number) => num === 0 ? '-' : num.toLocaleString('ko-KR');

  // Net Cash (현금 및 현금성자산 - 단기차입금)
  let netCashStr = '-';
  if (현금성자산 !== null || 단기차입금 !== null) {
      const c = 현금성자산 || 0;
      const d = 단기차입금 || 0;
      netCashStr = (c - d).toLocaleString('ko-KR');
  }

  // [네이버 파트] 과거 데이터 복원 (연간/분기 구분)
  let hCP: number | null = null;
  let hMC: number | null = null;

  if (reprtCode === '11011') {
    // 연간 데이터
    const annual = naverStockInfo.annualData[yearStr] || { historicalClosePrice: null, historicalMarketCap: null };
    hCP = annual.historicalClosePrice;
    hMC = annual.historicalMarketCap;
  } else {
    // 분기 데이터 매핑 (11013: 1Q, 11012: 2Q, 11014: 3Q)
    const monthMap: { [code: string]: string } = { '11013': '03', '11012': '06', '11014': '09' };
    const qKey = yearStr + (monthMap[reprtCode] || '03'); 
    const quarterly = naverStockInfo.quarterlyData[qKey] || { historicalClosePrice: null, historicalMarketCap: null };
    hCP = quarterly.historicalClosePrice;
    hMC = quarterly.historicalMarketCap;
  }
  
  // 과거 PER = 시가총액 / 과거 단기순이익 환산
  let histPer = '-';
  if (hMC !== null && 당기순이익 > 0) {
      histPer = (hMC / 당기순이익).toFixed(2) + '배';
  } else if (hMC !== null && 당기순이익 < 0) {
      histPer = '적자(N/A)';
  }

  // 지분구조 다중 추출 (상위 5인 이내)
  const holders: string[] = [];
  if (shareholders && shareholders.length > 0) {
      const topN = shareholders.slice(0, 5); 
      for (const s of topN) {
          holders.push(`${s.nm} ${s.trmend_posesn_stock_qota_rt}%`);
      }
  } else {
      holders.push('정보 없음'); // [요청사항] 지분 정보가 없으면 "정보 없음" 표시
  }

  return {
    periodLabel,
    매출액: fmt(매출액),
    영업이익: fmt(영업이익),
    당기순이익: fmt(당기순이익),
    자산총계: fmt(자산총계),
    부채총계: fmt(부채총계),
    자본총계: fmt(자본총계),
    부채비율,
    영업이익률,
    // 복구된 정통 Net Cash
    현금및현금성자산: 현금성자산 !== null ? fmt(현금성자산) : '-',
    단기차입금: 단기차입금 !== null ? fmt(단기차입금) : '-',
    NetCash: netCashStr !== '-' ? netCashStr : '-',
    // 과거 기말 종가 반영
    해당연도종가: hCP ? hCP.toLocaleString('ko-KR') + '원' : '-',
    해당연도시가총액: hMC ? Math.round(hMC / 100000000).toLocaleString('ko-KR') + '억' : '-',
    해당연도PER: histPer,
    주요주주목록: holders
  };
}
