import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  ChevronDown, Download, FilterX, LayoutDashboard, Menu, Search, ShoppingBag,
  Sparkles, TrendingUp, Users, Wallet, X
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';


const COLORS = ['#8178fa', '#41c6b7', '#f5ba66', '#ef7b9d', '#75a8ef'];
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const shortCurrency = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${Math.round(n)}`;
const integer = new Intl.NumberFormat('en-IN');
const dateLabel = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

async function requestData(path, options) {
  const response = await fetch('/api' + path, options);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) {
    throw new Error(result?.message || 'Could not reach the sales data service. Try again.');
  }
  return result;
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      setData(await requestData('/orders', { signal }));
    } catch (error) {
      if (!signal?.aborted) {
        setError(error instanceof TypeError ? 'Could not connect to the sales data service. Try again.' : error.message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  if (!data) {
    return <main className="content-container"><div className="panel data-panel">
      <h1>SalesPulse</h1>
      {loading && <p role="status">Loading sales data…</p>}
      {error && <><p role="alert">{error}</p><button className="primary-btn" onClick={() => refresh()}>Retry</button></>}
    </div></main>;
  }
  return <Dashboard data={data} loading={loading} error={error} refresh={refresh}/>;
}

function DataControls({ loading, error, refresh }) {
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  async function importOrders(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get('orders');
    setFeedback(null);
    if (!file.size || file.size > 1024 * 1024) {
      setFeedback({ error: true, message: 'Choose a CSV file between 1 byte and 1 MB.' });
      return;
    }

    setImporting(true);
    try {
      const result = await requestData('/orders/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/csv',
          Authorization: 'Bearer ' + fields.get('token'),
        },
        body: file,
      });
      form.reset();
      setFeedback({ message: `Orders imported: ${result.imported}. Duplicate IDs skipped: ${result.skipped}.` });
      await refresh();
    } catch (error) {
      setFeedback({ error: true, message: error instanceof TypeError ? 'Could not connect to the import service. Try again.' : error.message });
    } finally {
      setImporting(false);
    }
  }
  return <section className="panel data-panel" aria-label="Sales data controls">
    <div className="data-actions">
      <button className="reset-btn" disabled={loading || importing} onClick={() => refresh()}>
        {error ? 'Retry refresh' : 'Refresh data'}
      </button>
      {loading && <p role="status">Refreshing sales data…</p>}
      {error && <p role="alert">{error} Showing the last loaded data.</p>}
    </div>
    <details>
      <summary>Import orders from CSV</summary>
      <p className="muted">Use the six columns from Export report. Existing order IDs are skipped.</p>
      <form className="data-actions" onSubmit={importOrders}>
        <label>Orders CSV <input name="orders" type="file" accept=".csv,text/csv" required/></label>
        <label>Import key <input name="token" type="password" autoComplete="off" required/></label>
        <button className="primary-btn" disabled={importing || loading}>{importing ? 'Importing…' : 'Import orders'}</button>
      </form>
      {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    </details>
  </section>;
}

function TooltipCard({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><p className="font-semibold text-white mb-1">{label}</p>{payload.map((item, index) => <p key={index} style={{ color: item.color || '#a9a4ff' }}>{item.name}: {currency.format(item.value)}</p>)}</div>;
}
function KpiCard({ icon: Icon, label, value, caption, tone }) {
  return <div className="panel kpi-card">
    <div className="flex items-center justify-between gap-3"><span className="muted text-sm font-medium">{label}</span><span className={`kpi-icon ${tone}`}><Icon size={18}/></span></div>
    <div className="mt-3 text-[clamp(1.35rem,2.1vw,2rem)] font-bold tracking-tight text-white">{value}</div>
    <p className="mt-2 text-xs text-slate-400">{caption}</p>
  </div>;
}
function SelectField({ label, value, options, onChange }) {
  return <label className="field-wrap"><span className="field-label">{label}</span><span className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select><ChevronDown size={14}/></span></label>;
}
function Dashboard({ data, loading, error, refresh }) {
  const { orders, loadedAt } = data;
  const regions = useMemo(() => [...new Set(orders.map(order => order.region))].sort(), [orders]);
  const categories = useMemo(() => [...new Set(orders.map(order => order.category))].sort(), [orders]);
  const earliest = orders.at(-1)?.date ?? '';
  const latest = orders[0]?.date ?? '';
  const [region, setRegion] = useState('All Regions');
  const [category, setCategory] = useState('All Categories');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const rangeError = Boolean(orders.length && (from || earliest) > (to || latest));

  const filtered = useMemo(() => rangeError ? [] : orders.filter((r) =>
    (region === 'All Regions' || r.region === region) &&
    (category === 'All Categories' || r.category === category) &&
    (!from || r.date >= from) && (!to || r.date <= to)
  ), [orders, region, category, from, to, rangeError]);

  const stats = useMemo(() => {
    const revenue = filtered.reduce((total, item) => total + Math.round(item.amount * 100), 0) / 100;
    return { revenue, orders: filtered.length, aov: filtered.length ? revenue / filtered.length : 0, customers: new Set(filtered.map((item) => item.customer)).size };
  }, [filtered]);

  const monthData = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => { const k = r.date.slice(0, 7); map.set(k, (map.get(k) || 0) + r.amount); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, revenue]) => ({ month: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), revenue }));
  }, [filtered]);
  const categoryData = useMemo(() => categories.map(name => ({ name, revenue: filtered.filter(d => d.category === name).reduce((sum, order) => sum + Math.round(order.amount * 100), 0) / 100 })), [filtered, categories]);
  const regionData = useMemo(() => regions.map(name => ({ name, revenue: filtered.filter(d => d.region === name).reduce((sum, order) => sum + Math.round(order.amount * 100), 0) / 100 })), [filtered, regions]);
  const tableRows = useMemo(() => filtered.filter(r => [r.id,r.customer,r.region,r.category].some(v => v.toLowerCase().includes(search.toLowerCase()))), [filtered,search]);
  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const currentPage = Math.min(page,totalPages);
  const reset = () => { setRegion('All Regions');setCategory('All Categories');setFrom('');setTo('');setSearch('');setPage(1); };
  const exportCSV = () => {
    const heading = 'Order ID,Order Date,Customer ID,Product Category,Region,Sales Amount';
    const lines = filtered.map(r => [r.id, r.date, r.customer, r.category, r.region, r.amount.toFixed(2)]
      .map(value => '"' + value.replaceAll('"', '""') + '"').join(','));
    const blob = new Blob([[heading, ...lines].join('\n')], {type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='salespulse-filtered-orders.csv';link.click();URL.revokeObjectURL(url);
  };
  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="logo-row"><div className="logo-mark"><Activity size={21} strokeWidth={2.8}/></div><div><div className="text-white font-bold text-lg tracking-tight">SalesPulse<span className="text-violet-400">.</span></div><div className="text-[10px] tracking-[0.2em] uppercase text-slate-500">Analytics suite</div></div><button className="lg:hidden ml-auto text-slate-400" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20}/></button></div>
      <div className="sidebar-section-label">Workspace</div>
      <nav aria-label="Main navigation"><a href="#overview" className="nav-link active" onClick={() => setSidebarOpen(false)}><LayoutDashboard size={18}/> Overview <span className="ml-auto tiny-dot"/></a><a href="#trends" className="nav-link" onClick={() => setSidebarOpen(false)}><TrendingUp size={18}/> Sales trends</a><a href="#transactions" className="nav-link" onClick={() => setSidebarOpen(false)}><ShoppingBag size={18}/> Transactions</a></nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><div className="flex items-center gap-2 text-violet-200 font-semibold text-sm"><Sparkles size={16}/> Insight at a glance</div><p className="text-xs text-slate-400 mt-2 leading-relaxed">Explore orders, revenue and customers across your business.</p></div><div className="flex items-center gap-3 mt-5"><div className="profile-bubble">SA</div><div><p className="text-sm font-medium text-slate-200">Sales Analyst</p><p className="text-xs text-slate-500">Demo workspace</p></div></div></div>
    </aside>
    <main className="main" id="overview">
      <header className="topbar"><div className="flex items-center gap-3"><button className="menu-btn lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><span className="text-slate-400 text-sm">Workspace</span><span className="text-slate-600">/</span><span className="text-slate-200 font-medium text-sm">Overview</span></div><div className="topbar-right"><span className="status-indicator"/><span>Demo data</span><span className="hidden sm:inline text-slate-600 mx-1">•</span><span className="hidden sm:inline">Loaded {new Date(loadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></div></header>
      <div className="content-container">
        <div className="hero-row"><div><div className="eyebrow"><span className="eyebrow-dot"/> SALES INTELLIGENCE</div><h1>Sales Overview<span className="text-violet-400">.</span></h1><p className="text-slate-400 mt-2 text-sm sm:text-base">A clearer view of your business performance.</p></div><button className="primary-btn" onClick={exportCSV}><Download size={16}/> <span>Export report</span></button></div>
        <DataControls loading={loading} error={error} refresh={refresh}/>
        <section className="filter-panel" aria-label="Dashboard filters"><div className="filter-title"><span className="filter-icon"><CalendarDays size={18}/></span><div><p className="text-white text-sm font-semibold">Filters</p><p className="text-slate-500 text-xs">Refine your view</p></div></div><div className="filter-grid"><SelectField label="REGION" value={region} onChange={v=>{setRegion(v);setPage(1)}} options={['All Regions',...regions]}/><SelectField label="CATEGORY" value={category} onChange={v=>{setCategory(v);setPage(1)}} options={['All Categories',...categories]}/><label className="field-wrap"><span className="field-label">FROM</span><input aria-label="From date" type="date" value={from || earliest} min={earliest} max={latest} onChange={e=>{setFrom(e.target.value);setPage(1)}}/></label><label className="field-wrap"><span className="field-label">TO</span><input aria-label="To date" type="date" value={to || latest} min={earliest} max={latest} onChange={e=>{setTo(e.target.value);setPage(1)}}/></label></div><button className="reset-btn" onClick={reset} title="Reset all filters"><FilterX size={17}/><span>Reset</span></button></section>
        {rangeError && <div className="warning">The start date cannot be later than the end date. Please update your filters.</div>}
        <div className="section-heading"><div><p className="section-kicker">PERFORMANCE SNAPSHOT</p><h2>Key metrics</h2></div><div className="count-pill">{integer.format(filtered.length)} matching orders</div></div>
        <section className="kpi-grid" aria-label="Key performance indicators"><KpiCard icon={Wallet} label="Total Revenue" value={currency.format(stats.revenue)} caption="Sum of sales amount" tone="violet"/><KpiCard icon={ShoppingBag} label="Total Orders" value={integer.format(stats.orders)} caption="Orders in selected period" tone="teal"/><KpiCard icon={BarChart3} label="Average Order Value" value={currency.format(stats.aov)} caption="Revenue divided by orders" tone="amber"/><KpiCard icon={Users} label="Total Customers" value={integer.format(stats.customers)} caption="Unique customer IDs" tone="rose"/></section>
        <div className="section-heading" id="trends"><div><p className="section-kicker">REVENUE ANALYSIS</p><h2>Trends & performance</h2></div></div>
        <section className="charts-grid"><div className="panel chart-panel"><div className="chart-head"><div><h3>Revenue over time</h3><p>Monthly revenue trend</p></div><span className="chart-head-icon"><TrendingUp size={17}/></span></div>{monthData.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthData} margin={{top:12,right:6,left:-15,bottom:0}}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#897ff9" stopOpacity={0.32}/><stop offset="96%" stopColor="#897ff9" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#263047" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{fill:'#8390a7',fontSize:11}} minTickGap={22}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#8390a7',fontSize:11}} tickFormatter={shortCurrency}/><Tooltip content={<TooltipCard/>}/><Area type="monotone" dataKey="revenue" name="Revenue" stroke="#9187ff" strokeWidth={3} fill="url(#revenueFill)" activeDot={{r:5,fill:'#9187ff',stroke:'#171c2c',strokeWidth:3}}/></AreaChart></ResponsiveContainer></div> : <EmptyChart/>}</div>
          <div className="panel chart-panel"><div className="chart-head"><div><h3>Sales by category</h3><p>Revenue across product categories</p></div><span className="chart-head-icon"><BarChart3 size={17}/></span></div>{filtered.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} layout="vertical" margin={{top:4,right:12,left:12,bottom:0}}><CartesianGrid stroke="#263047" horizontal={false} strokeDasharray="3 5"/><XAxis type="number" tickLine={false} axisLine={false} tick={{fill:'#8390a7',fontSize:11}} tickFormatter={shortCurrency}/><YAxis type="category" dataKey="name" width={95} tickLine={false} axisLine={false} tick={{fill:'#c2c9d7',fontSize:11}}/><Tooltip cursor={{fill:'rgba(255,255,255,.025)'}} content={<TooltipCard/>}/><Bar dataKey="revenue" name="Revenue" radius={[0,5,5,0]} maxBarSize={27}>{categoryData.map((_,i)=><Cell key={i} fill={COLORS[i % COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyChart/>}</div></section>
        <section className="panel region-panel"><div className="chart-head"><div><h3>Regional performance</h3><p>Where your revenue comes from</p></div><span className="chart-head-icon"><Activity size={17}/></span></div>{filtered.length ? <div className="region-rows">{regionData.map((r,i) => <div className="region-row" key={r.name}><div className="region-name"><span className="region-dot" style={{background:COLORS[i % COLORS.length]}}/>{r.name}</div><div className="region-track"><div className="region-fill" style={{width:`${stats.revenue ? r.revenue / stats.revenue * 100:0}%`,background:COLORS[i % COLORS.length]}}/></div><div className="region-value">{shortCurrency(r.revenue)}</div><div className="region-share">{stats.revenue ? (r.revenue / stats.revenue * 100).toFixed(1) : '0'}%</div></div>)}</div> : <EmptyChart/>}</section>
        <section className="panel table-panel" id="transactions"><div className="table-header"><div><h3>Recent transactions</h3><p>Detailed view of your filtered sales</p></div><label className="table-search"><Search size={16}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Search orders..." aria-label="Search orders"/></label></div><div className="table-scroll"><table><thead><tr><th>ORDER ID</th><th>DATE</th><th>CUSTOMER</th><th>CATEGORY</th><th>REGION</th><th className="amount-cell">SALES AMOUNT</th></tr></thead><tbody>{tableRows.slice((currentPage-1)*pageSize,currentPage*pageSize).map(r=><tr key={r.id}><td className="id-cell">{r.id}</td><td>{dateLabel(r.date)}</td><td>{r.customer}</td><td><span className="category-chip">{r.category}</span></td><td>{r.region}</td><td className="amount-cell amount-value">{currency.format(r.amount)}</td></tr>)}{!tableRows.length && <tr><td colSpan="6" className="table-empty">No orders match the selected filters.</td></tr>}</tbody></table></div><div className="table-footer"><span>Showing {tableRows.length ? (currentPage-1)*pageSize+1 : 0}–{Math.min(currentPage*pageSize,tableRows.length)} of {integer.format(tableRows.length)} orders</span><div className="pagination"><button disabled={currentPage<=1} onClick={()=>setPage(p=>p-1)} aria-label="Previous page">Previous</button><span>{currentPage} / {totalPages}</span><button disabled={currentPage>=totalPages} onClick={()=>setPage(p=>p+1)} aria-label="Next page">Next <ArrowRight size={13}/></button></div></div></section>
        <footer className="footer"><span>© 2026 SalesPulse · Analytics Dashboard</span><span>Built with React + Recharts · Synthetic sample data</span></footer>
      </div>
    </main>
  </div>;
}
function EmptyChart(){return <div className="empty-chart"><BarChart3 size={27}/><p>No data for the selected filters</p><span>Try adjusting your date, region or category.</span></div>}
export default App;
