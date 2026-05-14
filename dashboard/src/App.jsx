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
  Layers 
} from 'lucide-react';


const socket = io('http://localhost:5000');

function App() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');

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
        setLogs(data);
      } catch (err) {
        console.error("History fetch failed:", err);
      }
    };
    fetchHistory();

    
    socket.on('new-log', (log) => {
      setLogs((prev) => [log, ...prev].slice(0, 100)); 
    });

    return () => socket.off('new-log');
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Top Navigation Bar */}
      <nav className="border-b border-slate-800 bg-[#020617]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
              <Terminal className="text-white" size={20} />
            </div>
            <div>
              <span className="text-white font-bold tracking-tight text-lg">Sentinel</span>
              <span className="text-blue-500 font-bold text-lg">Stream</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-full border border-slate-800">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-nowrap">System Live</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Analytics Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <StatCard title="Total Logs (DB)" value={logs.length} icon={<Database size={20}/>} color="text-blue-400" />
          <StatCard title="Critical Events" value={logs.filter(l => l.level === 'CRITICAL').length} icon={<ShieldAlert size={20}/>} color="text-red-400" />
          <StatCard title="Active Filters" value={filteredLogs.length} icon={<Layers size={20}/>} color="text-indigo-400" />
        </div>

        {/* Search & Filter Control Center */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-center shadow-inner">
          <div className="relative flex-grow min-w-[280px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search by message or service source..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer appearance-none"
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

        {/* Real-time Log Stream Table */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Severity</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Log Message</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-right">Service Origin</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-20 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Activity size={32} className="opacity-20 animate-pulse" />
                        <p className="italic text-sm">No log entries found matching criteria</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-blue-500/[0.03] transition-colors group">
                      <td className="px-6 py-4">
                        <Badge level={log.level} />
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-300 max-w-md truncate group-hover:text-white transition-colors">
                        {log.message}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] bg-slate-800/50 text-slate-400 px-2 py-1 rounded border border-slate-700 font-medium">
                          {log.source}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-slate-500 text-xs font-mono">
                          <Clock size={12} />
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


function StatCard({ title, value, icon, color }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg bg-slate-950 border border-slate-800 ${color} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <span className="text-slate-700 text-[10px] font-bold uppercase tracking-widest">Real-time</span>
      </div>
      <p className="text-slate-500 text-xs font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}

function Badge({ level }) {
  const styles = {
    CRITICAL: "bg-red-500/10 text-red-400 border-red-500/40",
    ERROR: "bg-orange-500/10 text-orange-400 border-orange-500/40",
    WARN: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
    INFO: "bg-blue-500/10 text-blue-400 border-blue-500/40"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black tracking-tighter border ${styles[level] || styles.INFO}`}>
      {level}
    </span>
  );
}

export default App;