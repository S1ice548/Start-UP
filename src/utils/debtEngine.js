/**
 * Debt Repayment Calculation Engine (AI-Driven Automatic Strategy Selection)
 * Supports: Avalanche, Snowball, Tsunami, Snowflake, Landslide
 */

export const STRATEGIES_INFO = {
  avalanche: {
    key: "avalanche",
    name: "Avalanche (หิมะถล่ม)",
    outcomeLabel: "💰 ปิดหนี้เสียดอกต่ำสุด",
    description: "เน้นโปะหนี้ที่ดอกเบี้ยแพงที่สุดก่อน ประหยัดดอกเบี้ยมากที่สุดในทางคณิตศาสตร์",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30"
  },
  snowball: {
    key: "snowball",
    name: "Snowball (บอลหิมะ)",
    outcomeLabel: "⚡ ปิดหนี้เร็ว",
    description: "เน้นโปะหนี้ยอดคงเหลือน้อยที่สุดก่อน ปิดหนี้ก้อนแรกเร็ว สร้างกำลังใจ",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30"
  },
  tsunami: {
    key: "tsunami",
    name: "Tsunami (คลื่นสึนามิ)",
    outcomeLabel: "💧 เพิ่มกระแสเงินสด",
    description: "เน้นปิดหนี้ที่ต้องจ่ายขั้นต่ำสูงที่สุด เพื่อดึงกระแสเงินสดกลับมาเร็วที่สุด",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30"
  },
  snowflake: {
    key: "snowflake",
    name: "Snowflake (เกล็ดหิมะ)",
    outcomeLabel: "❄️ ลดยอดหนี้ให้น้อยลง",
    description: "เน้นเก็บหนี้เล็กหนี้ไมโครที่ใกล้จบให้หมดไปอย่างรวดเร็วทีละเล็กทีละน้อย",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
  },
  landslide: {
    key: "landslide",
    name: "Landslide (ดินถล่ม)",
    outcomeLabel: "⛰️ ลดภาระก้อนใหญ่",
    description: "เน้นโปะหนี้ยอดคงเหลือสูงที่สุดก่อน เพื่อลดภาระก้อนใหญ่และยอดคงค้างรวมอย่างชัดเจน",
    badgeColor: "bg-orange-500/20 text-orange-700 border-orange-500/30"
  }
};

/**
 * Main Payoff Calculator with AI Auto Selection
 */
export function calculateDebtPayoff(debts, extraBudget = 0, manualStrategy = null) {
  if (!debts || debts.length === 0) {
    return {
      totalMonths: 0,
      payoffDateStr: "ไม่มีรายการหนี้",
      totalInterestPaid: 0,
      totalInterestSaved: 0,
      monthsSaved: 0,
      monthlyTimeline: [],
      debtPayoffDetails: [],
      aiRecommendation: null,
      allSimulations: []
    };
  }

  const extraNum = Number(extraBudget) || 0;

  // 1. Calculate baseline (minimum payment only across avalanche)
  const baselineResult = simulatePayoff(debts, 0, "avalanche");

  // 2. Simulate ALL strategies with extra budget to determine AI decision
  const strategyKeys = ["avalanche", "snowball", "tsunami", "snowflake", "landslide"];
  const simulations = {};

  strategyKeys.forEach(stKey => {
    simulations[stKey] = simulatePayoff(debts, extraNum, stKey);
  });

  // 3. AI Automatic Strategy Selection logic
  const aiDecision = evaluateAiBestStrategy(simulations, baselineResult.totalInterestPaid);

  // Use manual strategy if explicitly provided, otherwise use AI auto-selected strategy
  const activeStrategyKey = manualStrategy || aiDecision.bestStrategyKey;
  const activeResult = simulations[activeStrategyKey] || simulations.avalanche;

  const interestSaved = Math.max(0, baselineResult.totalInterestPaid - activeResult.totalInterestPaid);
  const monthsSaved = Math.max(0, baselineResult.totalMonths - activeResult.totalMonths);

  // Format list of all simulations for UI comparison
  const allSimulationsList = strategyKeys.map(k => {
    const sim = simulations[k];
    const saved = Math.max(0, baselineResult.totalInterestPaid - sim.totalInterestPaid);
    return {
      key: k,
      name: STRATEGIES_INFO[k].name,
      totalInterestPaid: sim.totalInterestPaid,
      totalMonths: sim.totalMonths,
      interestSaved: saved,
      firstPayoffMonth: sim.firstPayoffMonth,
      isAiSelected: k === aiDecision.bestStrategyKey
    };
  });

  return {
    ...activeResult,
    activeStrategyKey,
    activeStrategyName: STRATEGIES_INFO[activeStrategyKey]?.name || activeStrategyKey,
    totalInterestSaved: interestSaved,
    monthsSaved: monthsSaved,
    baselineMonths: baselineResult.totalMonths,
    baselineInterest: baselineResult.totalInterestPaid,
    aiRecommendation: aiDecision,
    allSimulations: allSimulationsList
  };
}

/**
 * Smart AI Evaluation Rule Engine
 */
function evaluateAiBestStrategy(simulations, baselineInterest) {
  const keys = Object.keys(simulations);
  
  // Find minimum interest paid strategy
  let minInterest = Infinity;
  let minInterestKey = "avalanche";

  keys.forEach(k => {
    if (simulations[k].totalInterestPaid < minInterest) {
      minInterest = simulations[k].totalInterestPaid;
      minInterestKey = k;
    }
  });

  // Check interest differences relative to min interest
  const contenders = [];
  keys.forEach(k => {
    const diffPct = minInterest > 0 
      ? ((simulations[k].totalInterestPaid - minInterest) / minInterest) * 100 
      : 0;
    const diffAmount = simulations[k].totalInterestPaid - minInterest;

    if (diffPct <= 2.0) {
      contenders.push({
        key: k,
        diffPct,
        diffAmount,
        sim: simulations[k]
      });
    }
  });

  let chosenKey = minInterestKey;
  let reasoning = "";

  // Rule: If interest difference between top strategies is <= 2%, pick the one that gives earliest 1st debt payoff or fastest total finish!
  if (contenders.length > 1) {
    // Sort contenders by firstPayoffMonth (ascending), then totalMonths (ascending), then interest
    contenders.sort((a, b) => {
      if (a.sim.firstPayoffMonth !== b.sim.firstPayoffMonth) {
        return a.sim.firstPayoffMonth - b.sim.firstPayoffMonth;
      }
      if (a.sim.totalMonths !== b.sim.totalMonths) {
        return a.sim.totalMonths - b.sim.totalMonths;
      }
      return a.diffAmount - b.diffAmount;
    });

    const winner = contenders[0];
    chosenKey = winner.key;

    if (chosenKey === minInterestKey) {
      reasoning = `AI เลือกวิธี **${STRATEGIES_INFO[chosenKey].name}** ให้อัตโนมัติ เนื่องจากเป็นวิธีที่ช่วยประหยัดดอกเบี้ยรวมได้สูงสุด (${formatCurrency(simulations[chosenKey].totalInterestPaid)}) และช่วยปิดหนี้ได้เร็วที่สุด`;
    } else {
      const savedDiff = Math.round(winner.diffAmount);
      reasoning = `AI เลือกวิธี **${STRATEGIES_INFO[chosenKey].name}** ให้อัตโนมัติ เนื่องจากประหยัดดอกเบี้ยใกล้เคียงวิธีสูงสุด (ต่างกันไม่เกิน 2% หรือเพียง ${formatCurrency(savedDiff)}) แต่วิธีนี้ช่วยปิดหนี้ก้อนแรกได้สำเร็จเร็วที่สุดใน **เดือนที่ ${winner.sim.firstPayoffMonth}** ช่วยเพิ่มกำลังใจและคืนสภาพคล่องเงินสดต่อเดือนให้อย่างรวดเร็ว`;
    }
  } else {
    chosenKey = minInterestKey;
    const secondCheapest = keys.map(k => simulations[k].totalInterestPaid).sort((a, b) => a - b)[1] || minInterest;
    const diffSavings = secondCheapest - minInterest;

    reasoning = `AI เลือกวิธี **${STRATEGIES_INFO[chosenKey].name}** ให้อัตโนมัติ เนื่องจากคำนวณแล้วพบว่าประหยัดเงินดอกเบี้ยได้มากกว่าวิธีอื่นอย่างมีนัยสำคัญ (ประหยัดเพิ่มขึ้นอีก ${formatCurrency(diffSavings)})`;
  }

  return {
    bestStrategyKey: chosenKey,
    bestStrategyName: STRATEGIES_INFO[chosenKey].name,
    reasoning
  };
}

/**
 * Core Simulation Engine per strategy
 */
function simulatePayoff(initialDebts, extraMonthlyBudget, strategy) {
  let currentDebts = initialDebts.map(d => ({
    id: d.id,
    name: d.name,
    lender: d.lender,
    balance: Number(d.balance),
    interestRate: Number(d.interestRate),
    minPayment: Number(d.minPayment),
    dueDate: d.dueDate || "15 ของทุกเดือน",
    originalBalance: Number(d.balance),
    paidOffMonth: null,
    totalInterestPaidOnThis: 0
  }));

  let totalInterestPaid = 0;
  let monthCount = 0;
  let firstPayoffMonth = 999;
  const MAX_MONTHS = 360;
  const monthlyTimeline = [];

  // Custom Sorter per Strategy
  const sortDebts = (list) => {
    return list.sort((a, b) => {
      // Keep paid off debts at end
      if (a.balance <= 0 && b.balance > 0) return 1;
      if (b.balance <= 0 && a.balance > 0) return -1;
      if (a.balance <= 0 && b.balance <= 0) return 0;

      switch (strategy) {
        case "avalanche":
          // Highest interest rate first
          return b.interestRate - a.interestRate;

        case "snowball":
          // Smallest balance first
          return a.balance - b.balance;

        case "tsunami":
          // Free cashflow: Highest min payment first
          return b.minPayment - a.minPayment;

        case "snowflake":
          // Micro-wins: Smallest remaining balance with heavy bonus for debts < 25,000
          const weightA = a.balance < 25000 ? a.balance * 0.4 : a.balance;
          const weightB = b.balance < 25000 ? b.balance * 0.4 : b.balance;
          return weightA - weightB;

        case "landslide":
          // Reduce the largest principal burden first; use interest rate as a tie-breaker.
          if (b.balance !== a.balance) return b.balance - a.balance;
          return b.interestRate - a.interestRate;

        default:
          return b.interestRate - a.interestRate;
      }
    });
  };

  while (monthCount < MAX_MONTHS) {
    const activeDebts = currentDebts.filter(d => d.balance > 0);
    if (activeDebts.length === 0) break;

    monthCount++;
    let totalMonthlyInterestThisMonth = 0;
    let extraAvailable = Number(extraMonthlyBudget);

    // Step 1: Add monthly interest
    currentDebts.forEach(d => {
      if (d.balance > 0) {
        const monthlyRate = (d.interestRate / 100) / 12;
        const interest = d.balance * monthlyRate;
        d.balance += interest;
        d.totalInterestPaidOnThis += interest;
        totalMonthlyInterestThisMonth += interest;
      }
    });

    // Step 2: Pay minimum required payments
    currentDebts.forEach(d => {
      if (d.balance > 0) {
        const payment = Math.min(d.balance, d.minPayment);
        d.balance -= payment;
        if (d.balance <= 0) {
          d.balance = 0;
          if (!d.paidOffMonth) {
            d.paidOffMonth = monthCount;
            if (monthCount < firstPayoffMonth) firstPayoffMonth = monthCount;
          }
        }
      }
    });

    // Step 3: Apply extra monthly budget to target debt based on strategy sorting
    sortDebts(currentDebts);

    for (let d of currentDebts) {
      if (d.balance > 0 && extraAvailable > 0) {
        const extraPayment = Math.min(d.balance, extraAvailable);
        d.balance -= extraPayment;
        extraAvailable -= extraPayment;

        if (d.balance <= 0) {
          d.balance = 0;
          if (!d.paidOffMonth) {
            d.paidOffMonth = monthCount;
            if (monthCount < firstPayoffMonth) firstPayoffMonth = monthCount;
          }
        }
      }
    }

    totalInterestPaid += totalMonthlyInterestThisMonth;
    const remainingTotalBalance = currentDebts.reduce((sum, d) => sum + d.balance, 0);
    const paidCount = currentDebts.filter(d => d.balance <= 0).length;

    monthlyTimeline.push({
      month: monthCount,
      totalBalance: Math.round(remainingTotalBalance),
      interestPaid: Math.round(totalMonthlyInterestThisMonth),
      debtsPaidCount: paidCount
    });
  }

  if (firstPayoffMonth === 999) firstPayoffMonth = monthCount;

  // Format date string
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() + monthCount, 1);
  const monthNamesThai = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];
  const formattedYearThai = targetDate.getFullYear() + 543;
  const years = Math.floor(monthCount / 12);
  const remainingMonths = monthCount % 12;

  let durationText = "";
  if (years > 0) durationText += `${years} ปี `;
  if (remainingMonths > 0 || years === 0) durationText += `${remainingMonths} เดือน`;

  const payoffDateStr = `${monthNamesThai[targetDate.getMonth()]} ${formattedYearThai} (${durationText.trim()})`;

  return {
    totalMonths: monthCount,
    firstPayoffMonth,
    payoffDateStr,
    totalInterestPaid: Math.round(totalInterestPaid),
    monthlyTimeline,
    debtPayoffDetails: currentDebts.map(d => ({
      id: d.id,
      name: d.name,
      lender: d.lender,
      dueDate: d.dueDate,
      originalBalance: d.originalBalance,
      paidOffMonth: d.paidOffMonth || monthCount,
      totalInterestPaidOnThis: Math.round(d.totalInterestPaidOnThis)
    }))
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount || 0);
}
