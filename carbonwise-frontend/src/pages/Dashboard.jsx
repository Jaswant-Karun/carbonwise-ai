import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/Layout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const [activities, setActivities] = useState([]);
  const [ecoPlan, setEcoPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState('');

  // Form State
  const [activityType, setActivityType] = useState('transport');
  const [details, setDetails] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await api.get('/activities');
      setActivities(res.data);
    } catch (error) {
      console.error('Error fetching activities');
    }
  };

  const calculateEmissions = (type, detailStr) => {
    // Simple mock logic for MVP. In reality, details would be a JSON object parsed appropriately
    let val = parseFloat(detailStr);
    if (isNaN(val)) val = 10;

    switch (type) {
      case 'transport': return val * 0.21; // kg per km roughly
      case 'electricity': return val * 0.5; // kg per kWh
      case 'food': return val * 2.5; // kg per meal (beef etc.)
      default: return 1.5;
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    const carbon = calculateEmissions(activityType, details);
    try {
      await api.post('/activities', {
        activity_type: activityType,
        details: { value: details },
        carbon_emissions: carbon
      });
      setDetails('');
      fetchActivities();
    } catch (error) {
      alert('Error adding activity');
    }
  };

  const getEcoPlan = async () => {
    setPlanMessage('');
    setLoadingPlan(true);
    try {
      const res = await api.post('/ai/eco-plan', { activities });
      setEcoPlan(res.data.plan);
      if (res.data.fallback) {
        setPlanMessage(res.data.message || 'Gemini unavailable. Showing local plan.');
      }
    } catch (err) {
      console.error(err);
      const apiMessage = err?.response?.data?.message;
      setPlanMessage(apiMessage || 'Unable to generate plan right now. Please try again.');
    }
    setLoadingPlan(false);
  };

  const totalEmissions = activities.reduce((sum, act) => sum + parseFloat(act.carbon_emissions), 0);
  
  // Chart Data prep
  const chartData = {
    labels: activities.map(a => new Date(a.date).toLocaleDateString()).slice(0, 7).reverse(),
    datasets: [
      {
        label: 'Carbon Emissions (kg CO₂)',
        data: activities.map(a => parseFloat(a.carbon_emissions)).slice(0, 7).reverse(),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        tension: 0.4,
      }
    ],
  };

  return (
    <Layout>
        <div className="stat-grid">
          <div className="glass-panel stat-card">
            <h3>Total Footprint</h3>
            <div className="value">{totalEmissions.toFixed(2)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>kg CO₂</span></div>
          </div>
          <div className="glass-panel stat-card">
            <h3>Logged Activities</h3>
            <div className="value">{activities.length}</div>
          </div>
          <div className="glass-panel stat-card">
            <h3>Trees Needed</h3>
            {/* Roughly 20kg per tree per year */}
            <div className="value">{Math.ceil(totalEmissions / 20)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>🌲</span></div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1.5rem' }}>Log New Activity</h3>
            <form onSubmit={handleAddActivity}>
              <div className="input-group">
                <label>Activity Type</label>
                <select 
                  className="input-field" 
                  value={activityType}
                  onChange={e => setActivityType(e.target.value)}
                  style={{ appearance: 'none' }}
                >
                  <option value="transport">Transport (km driven)</option>
                  <option value="electricity">Electricity (kWh used)</option>
                  <option value="food">Food (Heavy meals/meat)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Distance / Amount</label>
                <input 
                  type="number" 
                  step="any"
                  className="input-field" 
                  placeholder="e.g. 15"
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn">Log Impact</button>
            </form>
          </div>

          <div className="glass-panel">
            <h3 style={{ marginBottom: '1.5rem' }}>Emissions Trend</h3>
            { activities.length > 0 ? (
              <div style={{ height: '250px' }}>
                <Line 
                  data={chartData} 
                  options={{ 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { color: 'rgba(255,255,255,0.05)' } },
                      y: { grid: { color: 'rgba(255,255,255,0.05)' } }
                    }
                  }} 
                />
              </div>
            ) : <p style={{ color: 'var(--text-muted)' }}>No activities logged yet.</p>}
          </div>
          
        </div>

        <div className="glass-panel" style={{ marginTop: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3>AI Sustainability Plan</h3>
            <button onClick={getEcoPlan} className="btn" style={{ width: 'auto', padding: '8px 16px' }} disabled={loadingPlan || activities.length === 0}>
              {loadingPlan ? 'Generating...' : '✨ Generate with Gemini'}
            </button>
          </div>

          {planMessage ? (
            <p style={{ color: '#fbbf24', marginBottom: '1rem' }}>{planMessage}</p>
          ) : null}
          
          {ecoPlan ? (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {ecoPlan}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Click generate to get a personalized environmental strategy based on your logged activities.</p>
          )}
        </div>

    
    </Layout>
  );
};

export default Dashboard;
