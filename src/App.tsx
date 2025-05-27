import { useState, useEffect } from 'react';
import { runSimulations, assetClasses, glidepaths as defaultGlidepaths } from './simulator';
import type { UserInputs } from './simulator';

const percentileSteps = Array.from({ length: 21 }, (_, i) => i * 5); // 0 to 100 in 5% steps
const isAdmin = true; // toggle this for admin mode

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

  const [glidepaths, setGlidepaths] = useState(() => {
    const saved = localStorage.getItem('glidepaths');
    return saved ? JSON.parse(saved) : { ...defaultGlidepaths };
  });

  useEffect(() => {
    localStorage.setItem('glidepaths', JSON.stringify(glidepaths));
  }, [glidepaths]);

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
    if (!glidepaths[inputs.profileName]) {
      alert("Selected profile no longer exists. Please choose another.");
      return;
    }
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
    console.log("Simulation result:", result);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Pension Outcomes Tool</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
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

        <div>
          <label style={{ fontWeight: 600 }}>Profile</label><br />
          <select
            value={inputs.profileName}
            onChange={(e) => handleChange('profileName', e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          >
            {Object.keys(glidepaths).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

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

      {isAdmin && (
        <div style={{ marginTop: '3rem' }}>
          <h2>🛠 Manage Lifestyle Profiles</h2>

          {Object.entries(glidepaths).map(([key, gp]) => {
            const profile = gp;
            return (
              <div key={key} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
                <h3>
                  {key}
                  <button
                    onClick={() => {
                      const updated = { ...glidepaths };
                      delete updated[key];
                      setGlidepaths(updated);
                    }}
                    style={{ marginLeft: '1rem', color: 'red' }}
                  >
                    Delete
                  </button>
                </h3>
                <label>Growth End:</label>
                <input
                  type="number"
                  value={profile.growthEnd}
                  onChange={e => {
                    const updated = { ...glidepaths };
                    updated[key].growthEnd = parseInt(e.target.value);
                    setGlidepaths(updated);
                  }}
                />
                <br />
                <label>Pre-Retirement End:</label>
                <input
                  type="number"
                  value={profile.preRetirementEnd}
                  onChange={e => {
                    const updated = { ...glidepaths };
                    updated[key].preRetirementEnd = parseInt(e.target.value);
                    setGlidepaths(updated);
                  }}
                />
                {['growth', 'preRetirement', 'atRetirement'].map(stage => (
                  <div key={stage}>
                    <h4>{stage}</h4>
                    {Object.entries(
                      profile[stage as keyof Omit<typeof profile, 'growthEnd' | 'preRetirementEnd'>].allocations
                    ).map(([asset, val]) => (
                      <div key={asset}>
                        <label>{asset}</label>
                        <input
                          type="number"
                          value={(val * 100).toFixed(2)}
                          onChange={e => {
                            const updated = { ...glidepaths };
                            updated[key][stage as keyof Omit<typeof profile, 'growthEnd' | 'preRetirementEnd'>].allocations[asset] =
                              parseFloat(e.target.value) / 100;
                            setGlidepaths(updated);
                          }}
                        /> %
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}

          <button
            onClick={() => {
              const newKey = prompt('Enter new profile name:');
              if (!newKey || glidepaths[newKey]) return;
              const newProfile = {
                growth: {
                  yearsToRetirement: 100,
                  allocations: Object.fromEntries(assetClasses.map(a => [a.name, 0]))
                },
                preRetirement: {
                  yearsToRetirement: 100,
                  allocations: Object.fromEntries(assetClasses.map(a => [a.name, 0]))
                },
                atRetirement: {
                  yearsToRetirement: 0,
                  allocations: Object.fromEntries(assetClasses.map(a => [a.name, 0]))
                },
                growthEnd: 15,
                preRetirementEnd: 10
              };
              setGlidepaths({ ...glidepaths, [newKey]: newProfile });
            }}
          >
            ➕ Add New Profile
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
