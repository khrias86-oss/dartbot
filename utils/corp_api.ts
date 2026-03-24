import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';

// DART 전체 회사목록(CORPCODE)을 저장해둘 로컬 캐시 경로 설정
const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'corp_code.json');

export interface CorpCodeInfo {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  modify_date: string;
}

/**
 * DART에서 제공하는 전 상장사 고유코드를 다운로드 및 파싱하여 캐싱합니다.
 */
export async function getCorpCodes(): Promise<CorpCodeInfo[]> {
  // 이미 캐시된 데이터가 있다면 무거운 다운로드/파싱 생략 (응답속도 최적화)
  if (fs.existsSync(CACHE_FILE_PATH)) {
    const rawData = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(rawData);
  }

  // DART 오픈 API를 통해 CORPCODE.xml.zip 파일 다운로드
  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) throw new Error("서버 환경 변수에 DART_API_KEY가 등록되지 않았습니다.");

  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('DART 서버에서 고유번호(CORPCODE) ZIP 파일을 받아오는 데 실패했습니다.');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 메모리 상에서 ZIP 파일 압축 해제
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  if (zipEntries.length === 0) {
    throw new Error("DART에서 받은 압축 파일에 데이터가 없습니다.");
  }

  // 내부 CORPCODE.xml 파일 내용을 문자열로 가져오기
  const xmlContent = zipEntries[0].getData().toString('utf-8');

  // 거대한 XML 구조를 JavaScript 객체 배열로 변환
  const result = await parseStringPromise(xmlContent, { explicitArray: false });
  
  let list = result.result.list;
  // 단일 항목일 경우 배열로 강제 치환 (보통은 무수히 많음)
  if (!Array.isArray(list)) {
      list = [list];
  }

  // 필요한 필드만 추출 (메모리 절약)
  const parsedList = list.map((item: any) => ({
    corp_code: item.corp_code,
    corp_name: item.corp_name,
    stock_code: item.stock_code,
    modify_date: item.modify_date
  }));

  // data 폴더가 없을 경우 생성 방어 로직
  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 생성된 JSON 객체 배열을 루트 data/ 폴더 하위에 파일로 백업(캐싱)
  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(parsedList), 'utf-8');

  return parsedList;
}

/**
 * 회사명(자연어)이나 상장번호를 입력하면 매칭되는 회사 리스트 상위 최대 10개를 반환합니다.
 */
export async function searchCompanyByName(query: string): Promise<CorpCodeInfo[]> {
  const allCorps = await getCorpCodes();
  
  // 회사 이름 또는 종목 코드와 부분 일치하는 기업 산출
  const matched = allCorps.filter(c => 
    c.corp_name.includes(query) || (c.stock_code && c.stock_code === query)
  );
  
  // 종목 코드(상장 여부)가 있는 기업을 먼저 띄우도록 우선순위 정렬 (옵션)
  matched.sort((a, b) => {
    if (a.stock_code.trim() && !b.stock_code.trim()) return -1;
    if (!a.stock_code.trim() && b.stock_code.trim()) return 1;
    return 0;
  });

  // 너무 많은 데이터가 프론트엔드로 나가는 것을 방지하기 위해 최대 10개로 컷팅
  return matched.slice(0, 10);
}
