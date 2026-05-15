import React from 'react';
import { Line } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  Filler 
} from 'chart.js';

// Registering components is mandatory for Chart.js
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  Filler
);

const LogChart = ({ chartData = [] }) => {
  // Safety check: If data is empty, show a loading state or empty graph
  if (!chartData || chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-slate-500">Waiting for stream data...</div>;
  }

  const data = {
    labels: chartData.map(d => d.time),
    datasets: [
      {
        label: 'Logs Ingested',
        data: chartData.map(d => d.count),
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allows chart to fill the parent container height
    animation: {
        duration: 0 // Set to 0 for a smoother "live" look as data flows in
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        titleColor: '#94a3b8',
        bodyColor: '#f1f5f9',
        borderColor: '#334155',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 }
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      }
    }
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
        <Line data={data} options={options} />
    </div>
  );
};

export default LogChart;