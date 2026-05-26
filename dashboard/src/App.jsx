import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Activity, 
  ShieldAlert, 
  Terminal, 
  Search, 
  Filter, 
  Database, 
  Clock, 
  Layers,
  BarChart3
} from 'lucide-react';
import LogChart from './components/LogChart';

const socket = io('http://localhost:5000');

function App() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [chartData, setChartData] = useState([]);
  const [queueSize, setQueueSize] = useState(0);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
      log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'ALL' || log.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('http://localhost:5000/logs');
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setLogs(data);
          
          const historyCounts = {};
          data.slice(0, 50).forEach(log => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            historyCounts[time] = (historyCounts[time] || 0) + 1;
          });

          const initialChart = Object.keys(historyCounts).map(time => ({
            time,
            count: historyCounts[time]
          })).slice(-20);

          setChartData(initialChart);
        } else {
          console.error("API did not return an array:", data);
          setLogs([]);
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setLogs([]); 
      }
    };

    const fetchQueueSize = async () => {
      try {
        const response = await fetch('http://localhost:5000/queue-size');
        const data = await response.json();
        setQueueSize(data.size || 0);
      } catch (err) {
        console.error(err);
      }
    };

    fetchHistory();
    const queueInterval = setInterval(fetchQueueSize, 2000);

    socket.on('new-log', (log) => {
      const now = new Date().toLocaleTimeString();
      setLogs((prev) => [log, ...prev].slice(0, 500));
      setChartData((prevData) => {
        const lastPoint = prevData[prevData.length - 1];
        if (lastPoint && lastPoint.time === now) {
          const updatedLastPoint = { ...lastPoint, count: lastPoint.count + 1 };
          return [...prevData.slice(0, -1), updatedLastPoint];
        } else {
          return [...prevData, { time: now, count: 1 }].slice(-20);
        }
      });
    });

    return () => {
      socket.off('new-log');
      clearInterval(queueInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-x-hidden selection:bg-indigo-500/30">
      {/* Decorative background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-900/10 blur-[150px] pointer-events-none" />

      <nav className="border-b border-white/5 bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-2 rounded-xl shadow-lg shadow-indigo-500/10">
              <Terminal className="text-white" size={18} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold tracking-tight text-base">Sentinel</span>
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent font-bold text-base">Stream</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-inner">
            <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-nowrap">Live Pipeline</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Main Chart Container with Glassmorphism */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <BarChart3 size={16} />
              </div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-300">Live Ingestion Trend</h2>
            </div>
            <div style={{ height: '280px', width: '100%', position: 'relative' }}>
              <LogChart chartData={chartData} />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Ingested" value={logs.length} icon={<Database size={18}/>} gradient="from-blue-500/10 to-indigo-500/5" iconColor="text-blue-400" />
          <StatCard title="Buffered (Redis)" value={queueSize} icon={<Clock size={18}/>} gradient="from-amber-500/10 to-orange-500/5" iconColor="text-amber-400" />
          <StatCard title="Critical Events" value={logs.filter(l => l.level === 'CRITICAL').length} icon={<ShieldAlert size={18}/>} gradient="from-rose-500/10 to-red-500/5" iconColor="text-rose-400" />
          <StatCard title="Matched Filter" value={filteredLogs.length} icon={<Layers size={18}/>} gradient="from-purple-500/10 to-pink-500/5" iconColor="text-purple-400" />
        </div>

        {/* Filter Toolbar Box */}
        <div className="bg-white/[0.01] border border-white/5 backdrop-blur-md p-4 rounded-2xl mb-6 flex flex-wrap gap-4 items-center shadow-lg shadow-black/10">
          <div className="relative flex-grow min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder="Filter by message or origin source..." 
              className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 text-slate-200"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <select 
              className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 cursor-pointer appearance-none text-slate-300"
              onChange={(e) => setFilterLevel(e.target.value)}
            >
              <option value="ALL">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warning</option>
              <option value="ERROR">Error</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>

        {/* Real-time Log Stream Terminal Grid */}
        <div className="bg-white/[0.02] border border-white/5 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-white/5">
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Severity</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Telemetry Payload</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-right">Source Origin</th>
                  <th className="px-6 py-3.5 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center text-slate-600">
                      <div className="flex flex-col items-center gap-2">
                        <Activity size={24} className="opacity-20 animate-pulse text-indigo-400" />
                        <p className="text-xs tracking-wide">Waiting for system logs matching telemetry parameters...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-3.5">
                        <Badge level={log.level} />
                      </td>
                      <td className="px-6 py-3.5 text-xs font-mono text-slate-400 max-w-md truncate group-hover:text-slate-200 transition-colors">
                        {log.message}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-[10px] bg-white/[0.03] text-slate-400 px-2 py-0.5 rounded-md border border-white/5 font-mono">
                          {log.source}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-500 text-xs font-mono">
                          {new Date(log.timestamp || Date.now()).toLocaleTimeString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, gradient, iconColor }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:border-white/10 transition-all shadow-xl group relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-40 transition-opacity group-hover:opacity-60`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl bg-slate-950/80 border border-white/5 ${iconColor} shadow-inner`}>
            {icon}
          </div>
          <span className="text-slate-600 text-[9px] font-bold uppercase tracking-wider">Metrics</span>
        </div>
        <p className="text-slate-500 text-[11px] font-medium tracking-wide mb-0.5">{title}</p>
        <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
      </div>
    </div>
  );
}

function Badge({ level }) {
  const styles = {
    CRITICAL: "bg-rose-500/5 text-rose-400 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.05)]",
    ERROR: "bg-orange-500/5 text-orange-400 border-orange-500/20",
    WARN: "bg-amber-500/5 text-amber-400 border-amber-500/20",
    INFO: "bg-blue-500/5 text-blue-400 border-blue-500/20"
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide border font-mono ${styles[level] || styles.INFO}`}>
      {level}
    </span>
  );
}

export default App;