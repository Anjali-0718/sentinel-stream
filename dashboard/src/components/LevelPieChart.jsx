import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const LevelPieChart = ({ logs }) => {
  const levels = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];
  const dataCounts = levels.map(lvl => logs.filter(l => l.level === lvl).length);

  const data = {
    labels: levels,
    datasets: [{
      data: dataCounts,
      backgroundColor: ['#3b82f6', '#eab308', '#f97316', '#ef4444'],
      borderWidth: 0,
    }],
  };

  const options = {
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 } } }
    },
    maintainAspectRatio: false
  };

  return <Pie data={data} options={options} />;
};

export default LevelPieChart;