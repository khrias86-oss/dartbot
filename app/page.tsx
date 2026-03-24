"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import styles from "./page.module.css";
import type { AdvancedFinancialMetrics, Shareholder } from "@/utils/dart_api";
import type { CorpCodeInfo } from "@/utils/corp_api";

export default function Home() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CorpCodeInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCorp, setSelectedCorp] = useState<CorpCodeInfo | null>(null);

  const [years, setYears] = useState("3");
  const [unit, setUnit] = useState("year");

  const [loading, setLoading] = useState(false);
  
  // 상태 구조 변환
  const [data, setData] = useState<AdvancedFinancialMetrics[] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(query)}`);
        const result = await res.json();
        if (res.ok && result.data) {
          const list: CorpCodeInfo[] = result.data;
          if (list.length === 1 && list[0].corp_name === query) {
            handleSelectCorp(list[0]);
          } else {
            setSuggestions(list);
            setShowSuggestions(true);
          }
        }
      } catch (err) { /* */ }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  const handleSelectCorp = (corp: CorpCodeInfo) => {
    setQuery(corp.corp_name);
    setSelectedCorp(corp);
    setShowSuggestions(false);
  };

  const handleFetchData = async () => {
    if (!selectedCorp) {
      setErrorMsg("정확한 회사를 먼저 검색 및 선택해주세요.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setData(null);

    try {
      const url = `/api/financials?corp_code=${selectedCorp.corp_code}&stock_code=${selectedCorp.stock_code}&years=${years}&unit=${unit}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "데이터를 긁어오지 못했습니다.");
      
      const validData = (json.data as AdvancedFinancialMetrics[]).filter(d => d.매출액 !== '-');
      setData(validData.reverse()); 
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (!data || data.length === 0) return;

    // 엑셀 데이터 구성 (가로축: 기간, 세로축: 지표)
    const aoa = [
      ["지표 항목 \\ 분석 기간", ...data.map(d => d.periodLabel)],
      ["매출액", ...data.map(d => d.매출액)],
      ["영업이익", ...data.map(d => d.영업이익)],
      ["당기순이익", ...data.map(d => d.당기순이익)],
      ["자산총계", ...data.map(d => d.자산총계)],
      ["부채총계", ...data.map(d => d.부채총계)],
      ["자본총계", ...data.map(d => d.자본총계)],
      ["부채비율", ...data.map(d => d.부채비율)],
      ["영업이익률", ...data.map(d => d.영업이익률)],
      ["현금 및 현금성자산", ...data.map(d => d.현금및현금성자산)],
      ["단기차입금", ...data.map(d => d.단기차입금)],
      ["Net Cash", ...data.map(d => d.NetCash)],
      ["주요 주주 지분", ...data.map(d => d.주요주주목록.join(' / '))],
      ["현 시점 종가", ...data.map(d => d.해당연도종가)],
      ["현 시점 시가총액", ...data.map(d => d.해당연도시가총액)],
      ["현 시점 PER", ...data.map(d => d.해당연도PER)],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DART_Analysis");

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${selectedCorp?.corp_name}_재무분석_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>인텔리전트 DART 봇</h1>
        <p className={styles.desc}>과거 수년간의 실제 가치(시가총액) 복원 및 DART 전체 재무제표 딥스캔 모델입니다.</p>

        {/* 컨트롤 패널 */}
        <div className={styles.controlPanel}>
          <div className={styles.searchWrapper}>
            <label>회사명 검색</label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (selectedCorp && e.target.value !== selectedCorp.corp_name) {
                  setSelectedCorp(null); 
                }
              }}
              placeholder="예: 삼성전자, 카카오"
              className={styles.searchInput}
            />
            {showSuggestions && suggestions.length > 0 && !selectedCorp && (
              <ul className={styles.suggestionsList}>
                {suggestions.map((c, i) => (
                  <li key={i} onClick={() => handleSelectCorp(c)}>
                    <span className={styles.corpName}>{c.corp_name}</span>
                    <span className={styles.stockCode}>{c.stock_code ? `(${c.stock_code})` : '(비상장)'}</span>
                  </li>
                ))}
              </ul>
            )}
            {selectedCorp && <div className={styles.successBadge}>✅ 타겟 고정 완료</div>}
          </div>

          <div className={styles.optionsWrapper}>
            <div className={styles.optionGroup}>
              <label>조회 기간</label>
              <select value={years} onChange={(e) => setYears(e.target.value)}>
                <option value="3">과거 3년</option>
                <option value="5">과거 5년</option>
                <option value="10">과거 10년</option>
              </select>
            </div>
            
            <div className={styles.optionGroup}>
              <label>표출 단위</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="year">연 단위 (Yearly)</option>
                <option value="quarter">분기 단위 (Quarterly)</option>
              </select>
            </div>
            
            <button className={styles.submitBtn} onClick={handleFetchData} disabled={loading || !selectedCorp}>
              {loading ? "재무제표 자료 조회 중" : "지표 조회하기"}
            </button>
          </div>
        </div>

        {errorMsg && <div className={styles.error}>{errorMsg}</div>}

        {/* 메인 재무 매트릭스 렌더링 */}
        {data && data.length > 0 && (
          <div className={styles.tableContainer}>
            <div className={styles.tableHeaderSection}>
              <h2 className={styles.tableTitle}>{selectedCorp?.corp_name} 통합 분석 데이터</h2>
              <button className={styles.exportBtn} onClick={handleExportExcel}>📊 엑셀 내보내기</button>
            </div>
            
            <div className={styles.scrollWrapper}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>지표 항목 \ 기간분석</th>
                    {data.map((d, i) => <th key={i}>{d.periodLabel}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {/* 주요 원시 지표 - 수익/안정성 */}
                  <tr className={styles.rowHeader}><td colSpan={data.length + 1}>[수익 및 자본 구조 - DART Origin]</td></tr>
                  <tr><th>매출액</th>{data.map((d, i) => <td key={i}>{d.매출액}</td>)}</tr>
                  <tr><th>영업이익</th>{data.map((d, i) => <td key={i}>{d.영업이익}</td>)}</tr>
                  <tr><th>당기순이익</th>{data.map((d, i) => <td key={i}>{d.당기순이익}</td>)}</tr>
                  <tr><th>자산총계</th>{data.map((d, i) => <td key={i}>{d.자산총계}</td>)}</tr>
                  <tr><th>부채총계</th>{data.map((d, i) => <td key={i}>{d.부채총계}</td>)}</tr>
                  <tr><th>자본총계</th>{data.map((d, i) => <td key={i}>{d.자본총계}</td>)}</tr>
                  <tr><th>★ 부채비율</th>{data.map((d, i) => <td key={i} className={styles.highlight}>{d.부채비율}</td>)}</tr>
                  <tr><th>★ 영업이익률</th>{data.map((d, i) => <td key={i} className={styles.highlight}>{d.영업이익률}</td>)}</tr>

                  {/* 현금성 지표 및 Net Cash 부활 */}
                  <tr className={styles.rowHeader}><td colSpan={data.length + 1}>[딥스캔: 유동성 및 차입금 현황]</td></tr>
                  <tr><th>현금 및 현금성자산</th>{data.map((d, i) => <td key={i}>{d.현금및현금성자산}</td>)}</tr>
                  <tr><th>단기차입금</th>{data.map((d, i) => <td key={i}>{d.단기차입금}</td>)}</tr>
                  <tr><th>🔥 Net Cash</th>{data.map((d, i) => <td key={i} className={styles.valFocus}>{d.NetCash}</td>)}</tr>
                  
                  {/* 지분 구조 기록 */}
                  <tr className={styles.rowHeader}><td colSpan={data.length + 1}>[경영권 현황 - 각 해당기간 말 기준]</td></tr>
                  <tr>
                    <th>주요 주주 지분율</th>
                    {data.map((d, i) => (
                      <td key={i} className={styles.highlight}>
                        {d.주요주주목록.map((txt, idx) => (
                          <div key={idx} style={{ marginBottom: "4px" }}>{txt}</div>
                        ))}
                      </td>
                    ))}
                  </tr>

                  {/* 과거 타임머신 가치 밸류에이션 추적 */}
                  <tr className={styles.rowHeader}><td colSpan={data.length + 1}>[과거 시점 정밀 주가/시총 동기화 (타임머신)]</td></tr>
                  <tr><th>기말 종가</th>{data.map((d, i) => <td key={i}>{d.해당연도종가}</td>)}</tr>
                  <tr><th>기말 시가총액</th>{data.map((d, i) => <td key={i} className={styles.valFocus}>{d.해당연도시가총액}</td>)}</tr>
                  <tr><th>기말 PER</th>{data.map((d, i) => <td key={i} className={styles.valFocus}>{d.해당연도PER}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '10px', fontSize: '13px', color: '#6b7280', textAlign: 'right' }}>
              💡 DART 전체 재무제표 딥스캔 엔진 발동. 일부 분기 실적의 경우 전체 재무제표를 공시하지 않아 결측이 될 수 있습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
