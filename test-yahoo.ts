import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const summary = await yahooFinance.quoteSummary('035720.KS', {
      modules: ['defaultKeyStatistics', 'financialData']
    });
    console.log("Summary:", summary.defaultKeyStatistics?.sharesOutstanding, summary.financialData?.totalCash);
    
    const hist = await yahooFinance.historical('035720.KS', {
      period1: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d'
    });
    console.log("Hist:", hist.length > 0 ? hist[hist.length - 1].close : null);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
