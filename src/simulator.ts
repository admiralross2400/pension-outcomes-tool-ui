type AssetClass = {
  name: string;
  expectedReturn: number;
  volatility: number;
  correlationToEquity: number;
};

type LifestyleProfile = {
  yearsToRetirement: number; // required by type
  allocations: { [assetName: string]: number };
};

export type UserInputs = {
  age: number;
  startingSalary: number;
  salaryInflation: number;
  contributionRate: number;
  existingPot: number;
  retirementAge: number;
  numSimulations: number;
  percentiles: number[];
  profileName: string;
};

type Glidepath = {
  growth: LifestyleProfile;
  preRetirement: LifestyleProfile;
  atRetirement: LifestyleProfile;
  growthEnd: number;
  preRetirementEnd: number;
};

function interpolateAllocations(start: { [asset: string]: number }, end: { [asset: string]: number }, progress: number): { [asset: string]: number } {
  const result: { [asset: string]: number } = {};
  for (const asset in start) {
    result[asset] = start[asset] + progress * (end[asset] - start[asset]);
  }
  return result;
}

function getGlidepathAllocation(yearsToRetirement: number, glidepath: Glidepath): { [asset: string]: number } {
  const { growth, preRetirement, atRetirement, growthEnd, preRetirementEnd } = glidepath;
  if (yearsToRetirement > growthEnd) {
    return growth.allocations;
  } else if (yearsToRetirement > preRetirementEnd) {
    const progress = (growthEnd - yearsToRetirement) / (growthEnd - preRetirementEnd);
    return interpolateAllocations(growth.allocations, preRetirement.allocations, progress);
  } else {
    const progress = (preRetirementEnd - yearsToRetirement) / preRetirementEnd;
    return interpolateAllocations(preRetirement.allocations, atRetirement.allocations, progress);
  }
}

function getMonthlyReturn(annualReturn: number): number {
  return Math.pow(1 + annualReturn, 1 / 12) - 1;
}

function getMonthlyVolatility(annualVol: number): number {
  return annualVol / Math.sqrt(12);
}

function normalRandom(): number {
  let u = 1 - Math.random();
  let v = 1 - Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const assetClasses: AssetClass[] = [
  { name: "Global Equity", expectedReturn: 0.0743, volatility: 0.1344, correlationToEquity: 1 },
  { name: "Private Assets", expectedReturn: 0.0892, volatility: 0.0986, correlationToEquity: 0.42 },
  { name: "Listed Alts", expectedReturn: 0.0815, volatility: 0.1455, correlationToEquity: 0.69 },
  { name: "UK Property", expectedReturn: 0.0834, volatility: 0.1306, correlationToEquity: 0.26 },
  { name: "Fixed Income - EMD", expectedReturn: 0.0689, volatility: 0.0795, correlationToEquity: 0.5 },
  { name: "Fixed Income - Developed Markets", expectedReturn: 0.0335, volatility: 0.0328, correlationToEquity: 0.02 },
  { name: "Money Markets", expectedReturn: 0.0289, volatility: 0.016, correlationToEquity: 0 },
];

const glidepaths: { [profileName: string]: Glidepath } = {
  SMA: {
    growth: {
      yearsToRetirement: 100,
      allocations: {
        "Global Equity": 0.793,
        "Private Assets": 0,
        "Listed Alts": 0.039,
        "UK Property": 0.023,
        "Fixed Income - EMD": 0.046,
        "Fixed Income - Developed Markets": 0.099,
        "Money Markets": 0.0
      }
    },
    preRetirement: {
      yearsToRetirement: 100,
      allocations: {
        "Global Equity": 0.572,
        "Private Assets": 0,
        "Listed Alts": 0.025,
        "UK Property": 0.022,
        "Fixed Income - EMD": 0.083,
        "Fixed Income - Developed Markets": 0.295,
        "Money Markets": 0.005
      }
    },
    atRetirement: {
      yearsToRetirement: 0,
      allocations: {
        "Global Equity": 0.35,
        "Private Assets": 0,
        "Listed Alts": 0.01,
        "UK Property": 0.02,
        "Fixed Income - EMD": 0.12,
        "Fixed Income - Developed Markets": 0.49,
        "Money Markets": 0.01
      }
    },
    growthEnd: 15,
    preRetirementEnd: 10
  },
  SMAHighGrowth: {
    growth: {
      yearsToRetirement: 100,
      allocations: {
        "Global Equity": 0.927,
        "Private Assets": 0,
        "Listed Alts": 0.05,
        "UK Property": 0.023,
        "Fixed Income - EMD": 0,
        "Fixed Income - Developed Markets": 0,
        "Money Markets": 0.0
      }
    },
    preRetirement: {
      yearsToRetirement: 100,
      allocations: {
        "Global Equity": 0.639,
        "Private Assets": 0,
        "Listed Alts": 0.03,
        "UK Property": 0.022,
        "Fixed Income - EMD": 0.06,
        "Fixed Income - Developed Markets": 0.245,
        "Money Markets": 0.005
      }
    },
    atRetirement: {
      yearsToRetirement: 0,
      allocations: {
        "Global Equity": 0.35,
        "Private Assets": 0,
        "Listed Alts": 0.01,
        "UK Property": 0.02,
        "Fixed Income - EMD": 0.12,
        "Fixed Income - Developed Markets": 0.49,
        "Money Markets": 0.01
      }
    },
    growthEnd: 15,
    preRetirementEnd: 10
  }
};


function simulateOneRun(
  user: UserInputs,
  assetClasses: AssetClass[],
  glidepathConfig: Glidepath
): number[] {
  const months = (user.retirementAge - user.age) * 12 + 1; // include starting point

  let pot = user.existingPot;
  let salary = user.startingSalary;

  const potTrajectory: number[] = [];
  potTrajectory.push(pot); // log initial pot before any contributions/returns


  for (let m = 0; m < months; m++) {
    const yearsToRetirement = (months - m) / 12;

    const allocation = getGlidepathAllocation(yearsToRetirement, glidepathConfig);

    const equity = assetClasses.find(a => a.name === "Global Equity");
    const z1 = normalRandom();
    const equityMonthlyReturn = getMonthlyReturn(equity!.expectedReturn) + getMonthlyVolatility(equity!.volatility) * z1;

    const assetReturns: { [assetName: string]: number } = {};
    for (const asset of assetClasses) {
      if (asset.name === "Global Equity") {
        assetReturns[asset.name] = equityMonthlyReturn;
      } else {
        const z2 = normalRandom();
        const monthlyVol = getMonthlyVolatility(asset.volatility);
        const monthlyReturn = getMonthlyReturn(asset.expectedReturn);
        const correlatedShock = z1 * asset.correlationToEquity + z2 * Math.sqrt(1 - Math.pow(asset.correlationToEquity, 2));
        assetReturns[asset.name] = monthlyReturn + monthlyVol * correlatedShock;
      }
    }

    let totalReturn = 0;
    for (const asset in allocation) {
      totalReturn += allocation[asset] * assetReturns[asset];
    }

    const contribution = salary * user.contributionRate / 12;
    pot = (pot + contribution) * (1 + totalReturn);
    salary *= Math.pow(1 + user.salaryInflation, 1 / 12);

    // Save this month's pot value
    potTrajectory.push(pot);
  }

  return potTrajectory;
}


const user: UserInputs = {
  age: 39,
  startingSalary: 57400,
  salaryInflation: 0.0,
  contributionRate: 0.14,
  existingPot: 103000,
  retirementAge: 67,
  numSimulations: 2000,
  percentiles: [5, 25, 50, 75, 95],
  profileName: "SMA"
};

function runSimulations(
  user: UserInputs,
  assetClasses: AssetClass[],
  glidepathConfig: Glidepath
): { [percentile: number]: number[] } {
  const months = (user.retirementAge - user.age) * 12 + 1;
  const trajectories: number[][] = [];

  for (let i = 0; i < user.numSimulations; i++) {
    const potPath = simulateOneRun(user, assetClasses, glidepathConfig);
    trajectories.push(potPath);
  }

  // For each month, calculate the requested percentiles
  const result: { [percentile: number]: number[] } = {};
  for (const p of user.percentiles) {
    result[p] = [];
  }

  for (let m = 0; m < months; m++) {
    const potsAtMonth = trajectories.map(t => t[m]).sort((a, b) => a - b);

    for (const p of user.percentiles) {
      const rank = (p / 100) * (potsAtMonth.length - 1);
      const lower = Math.floor(rank);
      const upper = Math.ceil(rank);
      const weight = rank - lower;
      const value = potsAtMonth[lower] * (1 - weight) + potsAtMonth[upper] * weight;
      result[p].push(value);
    }
  }

  return result;
}


export {
  runSimulations,
  assetClasses,
  glidepaths,
  };