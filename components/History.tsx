import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface HistoryProps {
  user: any;
}

export const History: React.FC<HistoryProps> = ({ user }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]);
    }
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12);

      if (!error) {
        setHistory(data || []);
      }
    } catch (err) {
      console.error('History fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to wipe your forensic history?')) return;
    
    try {
      const { error } = await supabase
        .from('analyses')
        .delete()
        .eq('user_id', user.id);
      
      if (!error) setHistory([]);
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) {
    return (
      <div className="py-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
         <span className="text-4xl mb-4">🗄️</span>
         <p className="text-slate-400 font-bold uppercase tracking-widest mono text-sm">Login to Track Audits</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-bold text-white tracking-tight">Audit History</h2>
        <p className="text-slate-400">Your secure database of authorship verifications.</p>
        <div className="flex justify-center gap-6">
          <button onClick={fetchHistory} className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest mono">Refresh</button>
          <button onClick={clearHistory} className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest mono">Wipe Data</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-500 animate-pulse uppercase tracking-widest mono">Synchronizing...</div>
        ) : history.length > 0 ? history.map((item, idx) => (
          <div key={item.id} className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-6 hover:border-emerald-500/20 transition-all group">
            <div className="flex justify-between items-start">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded uppercase tracking-widest mono">
                {item.context || 'General'}
              </span>
              <span className="text-[10px] text-slate-600 mono">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            <div className="space-y-2">
              <h4 className={`text-2xl font-black ${item.score > 50 ? 'text-red-400' : 'text-emerald-400'}`}>{item.score}% Alignment</h4>
              <p className="text-slate-500 text-xs line-clamp-2">{item.input_text.substring(0, 100)}...</p>
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-bold mono uppercase tracking-widest">
                Verdict: {item.verdict}
              </span>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30">
             <span className="text-4xl mb-4">🗄️</span>
             <p className="text-slate-400 font-bold uppercase tracking-widest mono text-sm">Empty Repository</p>
          </div>
        )}
      </div>
    </div>
  );
};