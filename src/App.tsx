import { useState } from 'react';
import { runSimulations, assetClasses, glidepaths } from './simulator';
import type { UserInputs } from './simulator';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';


function exportToCSV(data: any[], filename = 'simulation_results.csv') {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // header row
    ...data.map(row =>
      headers.map(h => row[h]).join(',')
    )
  ];

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const profileOptions = ['SMA', 'SMAHighGrowth'];
const percentileSteps = Array.from({ length: 21 }, (_, i) => i * 5); // 0 to 100 in 5% steps

function App() {
  const [inputs, setInputs] = useState({
    age: '22',
    startingSalary: '25000',
    salaryInflation: '0',
    contributionRate: '12',
    existingPot: '5000',
    retirementAge: '67',
    numSimulations: '2000',
    percentiles: ['5', '25', '50', '75', '95'],
    profileName: 'SMA',
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [finalResults, setFinalResults] = useState<{ [p: string]: number }>({});

  const handleChange = (field: string, value: string) => {
    setInputs({ ...inputs, [field]: value });
  };

  const handlePercentileChange = (index: number, value: string) => {
    const newPercentiles = [...inputs.percentiles];
    newPercentiles[index] = value;
    setInputs({ ...inputs, percentiles: newPercentiles });
  };

  const handleAddPercentile = () => {
    if (inputs.percentiles.length < 5) {
      setInputs({ ...inputs, percentiles: [...inputs.percentiles, '50'] });
    }
  };

  const handleRemovePercentile = (index: number) => {
    const newPercentiles = inputs.percentiles.filter((_, i) => i !== index);
    setInputs({ ...inputs, percentiles: newPercentiles });
  };

  const handleSubmit = () => {
    const parsedInputs: UserInputs = {
      age: parseInt(inputs.age),
      startingSalary: parseFloat(inputs.startingSalary),
      salaryInflation: parseFloat(inputs.salaryInflation) / 100,
      contributionRate: parseFloat(inputs.contributionRate) / 100,
      existingPot: parseFloat(inputs.existingPot),
      retirementAge: parseInt(inputs.retirementAge),
      numSimulations: parseInt(inputs.numSimulations),
      percentiles: inputs.percentiles.map(p => parseInt(p)),
      profileName: inputs.profileName
    };

    const result = runSimulations(parsedInputs, assetClasses, glidepaths[parsedInputs.profileName]);

    // Prepare chart data
    const months = result[parsedInputs.percentiles[0]].length;
    const data: any[] = [];
    for (let m = 0; m < months; m++) {
      const age = parsedInputs.age + m / 12;
      const entry: any = { age: parseFloat(age.toFixed(1)) };
      for (const p of parsedInputs.percentiles) {
        entry[`P${p}`] = Math.round(result[p][m]);
      }
      data.push(entry);
    }
    setChartData(data);

    // Calculate final values
    const final: { [p: string]: number } = {};
    for (const p of parsedInputs.percentiles) {
      const potArray = result[p];
      final[`P${p}`] = Math.round(potArray[potArray.length - 1]);
    }
    setFinalResults(final);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Pension Outcomes Tool</h1>

      {/* Two-column grid of inputs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {[
          ['age', 'Age'],
          ['startingSalary', 'Starting Salary (£)'],
          ['salaryInflation', 'Salary Inflation (%)'],
          ['contributionRate', 'Contribution Rate (%)'],
          ['existingPot', 'Existing Pot (£)'],
          ['retirementAge', 'Retirement Age'],
          ['numSimulations', 'Number of Simulations'],
        ].map(([key, label]) => (
          <div key={key}>
            <label style={{ fontWeight: 600 }}>{label}</label><br />
            <input
              type="text"
              value={(inputs as any)[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            />
          </div>
        ))}

        {/* Profile dropdown */}
        <div>
          <label style={{ fontWeight: 600 }}>Profile</label><br />
          <select
            value={inputs.profileName}
            onChange={(e) => handleChange('profileName', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          >
            {profileOptions.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Percentile Dropdowns */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontWeight: 600 }}>Percentiles (up to 5):</label>
        {inputs.percentiles.map((p, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <select
              value={p}
              onChange={(e) => handlePercentileChange(index, e.target.value)}
              style={{ padding: '0.5rem', fontSize: '1rem' }}
            >
              {percentileSteps.map(step => (
                <option key={step} value={step}>{step}%</option>
              ))}
            </select>
            <button
              onClick={() => handleRemovePercentile(index)}
              style={{ marginLeft: '0.5rem' }}
              disabled={inputs.percentiles.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={handleAddPercentile} disabled={inputs.percentiles.length >= 5}>
          + Add Percentile
        </button>
      </div>

      <button onClick={handleSubmit} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', fontSize: '1rem' }}>
        Run Simulation
      </button>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2>Projected Pension Pot Over Time</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" />
              <YAxis tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `£${v.toLocaleString()}`} />
              <Legend />
              {inputs.percentiles.map(p => (
                <Line
                  key={p}
                  type="monotone"
                  dataKey={`P${p}`}
                  strokeWidth={2}
                  stroke={`hsl(${parseInt(p) * 3}, 70%, 50%)`}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Final values table */}
          <table style={{ marginTop: '2rem', width: '100%', fontSize: '1rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem 1rem', borderBottom: '1px solid #ccc' }}>Percentile</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 1rem', borderBottom: '1px solid #ccc' }}>Final Pot (£)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(finalResults).map(([p, val]) => (
                <tr key={p}>
                  <td style={{ padding: '0.5rem 1rem' }}>{p}</td>
                  <td style={{ padding: '0.5rem 1rem' }}>£{val.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
  onClick={() => exportToCSV(chartData)}
  style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}
>
  Download CSV
</button>
        </div>
      )}
    </div>
  );
}

export default App;
