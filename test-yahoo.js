const yf = require('yahoo-finance2').default;
async function t() {
  try {
    const s = await yf.quoteSummary('035720.KS', { modules: ['defaultKeyStatistics', 'financialData'] });
    console.log(s.defaultKeyStatistics?.sharesOutstanding, s.financialData?.totalCash);
  } catch(e) {
    console.error(e.message);
  }
}
t();
