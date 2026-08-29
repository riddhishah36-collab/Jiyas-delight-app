import { useEffect, useRef, useState } from 'react';

const API = '/api';
const ADMIN_KEY = localStorage.getItem('jiya_admin_key') || '';
const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY });
const authHeaders = () => ({ 'x-admin-key': ADMIN_KEY });

const CATEGORY_LABELS = { cake: 'Cakes', bread: 'Bread', pastry: 'Pastries', savory: 'Savory' };

const PAYMENT_METHODS = [
  { id: 'promptpay', label: 'PromptPay (QR)', hint: 'Scan QR with any Thai bank app' },
  { id: 'cash', label: 'Cash on Delivery', hint: 'Pay in THB when order arrives' },
  { id: 'transfer', label: 'Bank Transfer', hint: 'Transfer to our bank account' }
];

const TASK_STATUS = ['pending', 'in_progress', 'done'];
const ORDER_STATUS = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
const FUTURE_STATUS = ['scheduled', 'preparing', 'ready', 'completed'];

function Currency({ amount }) {
  return <span>{Number(amount).toLocaleString('en-US')} ฿</span>;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function PhotoUpload({ onUploaded, multiple = true }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const handle = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('photo', f);
        const res = await fetch(API + '/upload', { method: 'POST', headers: authHeaders(), body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        onUploaded(data.url);
      }
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="photo-upload">
      <input ref={fileRef} type="file" accept="image/*" multiple={multiple} onChange={handle} hidden />
      <button className="btn btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Uploading...' : '📷 Add photo proof'}
      </button>
      {err && <span className="error">{err}</span>}
    </div>
  );
}

function PhotoStrip({ photos, onRemove }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="photo-strip">
      {photos.map((p, i) => (
        <div className="photo-thumb" key={i}>
          <img src={p} alt="proof" onClick={() => window.open(p, '_blank')} />
          {onRemove && (
            <button className="photo-remove" onClick={() => onRemove(p)}>✕</button>
          )}
        </div>
      ))}
    </div>
  );
}

function useNotifications() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [notifOpen, setNotifOpen] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(API + '/admin/notifications', { headers: authHeaders() });
      if (res.ok) setData(await res.json());
    } catch (_) {}
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const markRead = async (id) => {
    await fetch(API + '/admin/notifications/read', { method: 'POST', headers: headers(), body: JSON.stringify({ id: id || null }) });
    refresh();
  };

  return { ...data, refresh, markRead, notifOpen, setNotifOpen };
}

function NotificationBell({ n, markRead }) {
  const unread = n.unread || 0;
  return (
    <div className="notif-wrap">
      <button className="notif-bell" onClick={() => { n.setNotifOpen(!n.notifOpen); if (!n.notifOpen) n.refresh(); }}>
        🔔 {unread > 0 && <span className="notif-count">{unread}</span>}
      </button>
      {n.notifOpen && (
        <div className="notif-dropdown">
          <div className="notif-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="btn btn-sm" onClick={() => markRead(null)}>Mark all read</button>}
          </div>
          {n.notifications.length === 0 && <div className="muted notif-empty">No notifications yet</div>}
          {n.notifications.map((it) => (
            <div key={it.id} className={'notif-item ' + (it.read ? 'read' : 'unread')} onClick={() => markRead(it.id)}>
              <span className={'notif-type ' + it.type}>{it.type}</span>
              <p>{it.message}</p>
              <small className="muted">{fmtDate(it.createdAt)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ cart, onCartClick, onTrack, onAdmin, notif, markRead }) {
  const count = cart.reduce((s, x) => s + x.qty, 0);
  return (
    <header className="header">
      <div className="header-inner">
        <div className="brand" onClick={() => onCartClick('home')} role="button">
          <span className="brand-logo">🎂</span>
          <span className="brand-name">Jiya's Delight</span>
          <span className="brand-sub">Bakery & Cloud Kitchen · Bangkok</span>
        </div>
        <nav className="nav">
          <button onClick={() => onCartClick('home')}>Menu</button>
          <button onClick={() => onCartClick('custom')}>Custom Cake</button>
          <button onClick={() => onTrack()}>Track</button>
          <button onClick={() => onAdmin()} className="staff-btn">🏪 Staff Portal</button>
          <NotificationBell n={notif} markRead={markRead} />
          <button className="cart-btn" onClick={() => onCartClick('cart')}>
            🛒 <span className="cart-count">{count}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function ProductCard({ product, onAdd }) {
  const emoji = { cake: '🎂', bread: '🍞', pastry: '🥐', savory: '🥪' }[product.category] || '🍪';
  return (
    <div className="product-card">
      <div className="product-emoji">{emoji}</div>
      <div className="product-cat">{CATEGORY_LABELS[product.category] || product.category}</div>
      <h3 className="product-name">{product.name}</h3>
      <p className="product-desc">{product.description}</p>
      <div className="product-foot">
        <span className="product-price"><Currency amount={product.price} /></span>
        <button className="btn btn-primary btn-sm" onClick={() => onAdd(product)}>Add</button>
      </div>
    </div>
  );
}

function Home({ products, onAdd, cart, onCartClick }) {
  const [filter, setFilter] = useState('all');
  const categories = ['all', ...Object.keys(CATEGORY_LABELS)];
  const filtered = filter === 'all' ? products : products.filter((p) => p.category === filter);
  return (
    <div className="page">
      <section className="hero">
        <h1>Fresh from our Bangkok kitchen</h1>
        <p>Custom cakes, artisan bread, pastries and home-style food. Pay locally in Thai Baht.</p>
        <button className="btn btn-light" onClick={() => onCartClick('custom')}>Order a Custom Cake</button>
      </section>
      <section className="shop">
        <div className="tabs">
          {categories.map((c) => (
            <button key={c} className={'tab ' + (filter === c ? 'active' : '')} onClick={() => setFilter(c)}>
              {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="grid">
          {filtered.map((p) => <ProductCard key={p.id} product={p} onAdd={onAdd} />)}
        </div>
      </section>
      {cart.length > 0 && (
        <div className="floating-cart" onClick={() => onCartClick('cart')}>
          🛒 {cart.reduce((s, x) => s + x.qty, 0)} item(s) · <Currency amount={cart.reduce((s, x) => s + x.price * x.qty, 0)} />
        </div>
      )}
    </div>
  );
}

function CustomCake({ onCheckout }) {
  const [size, setSize] = useState('medium');
  const [flavour, setFlavour] = useState('Vanilla');
  const [message, setMessage] = useState('');
  const sizes = [
    { id: 'small', name: 'Small', size: '6"', price: 650 },
    { id: 'medium', name: 'Medium', size: '8"', price: 950 },
    { id: 'large', name: 'Large', size: '10"', price: 1400 }
  ];
  const flavours = ['Vanilla', 'Chocolate', 'Red Velvet', 'Pandan', 'Blueberry', 'Mango', 'Strawberry'];
  const sizeObj = sizes.find((s) => s.id === size);
  return (
    <div className="page">
      <section className="hero hero-sm">
        <h1>Custom Cake</h1>
        <p>Tell us what you want. We bake it fresh for you in Bangkok.</p>
      </section>
      <div className="custom-cake">
        <div className="custom-panel">
          <h3>Size</h3>
          <div className="size-row">
            {sizes.map((s) => (
              <button key={s.id} className={'size-btn ' + (size === s.id ? 'active' : '')} onClick={() => setSize(s.id)}>
                {s.name} <small>{s.size}</small> · <Currency amount={s.price} />
              </button>
            ))}
          </div>
          <h3>Flavour</h3>
          <div className="flavour-row">
            {flavours.map((f) => (
              <button key={f} className={'flavour-btn ' + (flavour === f ? 'active' : '')} onClick={() => setFlavour(f)}>{f}</button>
            ))}
          </div>
          <h3>Message on cake (optional)</h3>
          <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Happy Birthday!" maxLength={40} />
          <div className="custom-total">Total: <Currency amount={sizeObj.price} /></div>
          <button className="btn btn-primary btn-lg" onClick={() => onCheckout({ customCake: { size, flavour, message }, total: sizeObj.price, label: `Custom Cake (${size}) - ${flavour}` })}>
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

function Cart({ cart, setQty, remove, subtotal, onCheckout }) {
  const [delivery, setDelivery] = useState(true);
  const deliveryFee = delivery ? 50 : 0;
  if (cart.length === 0) {
    return (
      <div className="page center"><h2>Your cart is empty</h2><p>Add some treats from the menu!</p></div>
    );
  }
  return (
    <div className="page">
      <h2>Your Order</h2>
      <div className="cart-layout">
        <div className="cart-items">
          {cart.map((item) => (
            <div className="cart-item" key={item.productId}>
              <div className="cart-item-info">
                <strong>{item.name}</strong>
                <span><Currency amount={item.price} /> each</span>
              </div>
              <div className="qty-control">
                <button onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                <span>{item.qty}</span>
                <button onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
              </div>
              <span className="cart-item-total"><Currency amount={item.price * item.qty} /></span>
              <button className="remove-btn" onClick={() => remove(item.productId)}>✕</button>
            </div>
          ))}
        </div>
        <div className="summary">
          <h3>Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span><Currency amount={subtotal} /></span></div>
          <div className="summary-row">
            <span>Delivery</span>
            <label className="switch">
              <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
              <span className="switch-slider" />
            </label>
            <span>{delivery ? '50 ฿' : 'Pickup'}</span>
          </div>
          <div className="summary-row total"><span>Total</span><span><Currency amount={subtotal + deliveryFee} /></span></div>
          <button className="btn btn-primary btn-lg" onClick={() => onCheckout({ items: cart, deliveryFee })}>Checkout</button>
        </div>
      </div>
    </div>
  );
}

function Checkout({ cart, customCake, deliveryFee, subtotal, goHome }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState('promptpay');
  const [placing, setPlacing] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const total = (customCake ? customCake.total : subtotal) + (deliveryFee || 0);

  const place = async () => {
    if (!name || !phone) return setError('Please enter your name and phone number.');
    setPlacing(true);
    setError('');
    try {
      const body = { customer: { name, phone, address }, paymentMethod: method, deliveryFee: deliveryFee || 0 };
      if (customCake) body.customCake = customCake.customCake;
      else body.items = cart.map((c) => ({ productId: c.productId, qty: c.qty }));
      const res = await fetch(API + '/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      setOrder(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setPlacing(false);
    }
  };

  if (order) {
    return (
      <div className="page center success">
        <div className="success-emoji">✅</div>
        <h2>Order confirmed!</h2>
        <p>Order number: <strong>#{order.number}</strong></p>
        <p>Total: <Currency amount={order.total} /></p>
        <p className="muted">We'll call you at {order.customer.phone} to confirm. Save this order number to track it.</p>
        <button className="btn btn-primary" onClick={goHome}>Back to Menu</button>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Checkout</h2>
      <div className="checkout-layout">
        <div className="form">
          <h3>Your details</h3>
          <label className="field"><span>Name *</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></label>
          <label className="field"><span>Phone (TH) *</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" /></label>
          <label className="field"><span>Address</span><textarea className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address (Bangkok)" rows={2} /></label>
          <h3>Payment (THB)</h3>
          <div className="methods">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id} className={'method ' + (method === m.id ? 'active' : '')} onClick={() => setMethod(m.id)}>
                <strong>{m.label}</strong><small>{m.hint}</small>
              </button>
            ))}
          </div>
          {method === 'promptpay' && (
            <div className="qr-note">
              <strong>Scan & pay</strong>
              <div className="qr-box">081-234-5678</div>
              <small className="muted">Your PromptPay QR will be shown by our staff when your order is ready. Payment auto-recorded.</small>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-lg" onClick={place} disabled={placing}>{placing ? 'Placing order...' : `Pay ${total} ฿ & Confirm`}</button>
        </div>
        <div className="summary">
          <h3>Order summary</h3>
          {customCake ? (
            <div className="cart-item"><strong>{customCake.label}</strong><span><Currency amount={customCake.total} /></span></div>
          ) : (
            cart.map((i) => (
              <div className="cart-item" key={i.productId}>
                <span>{i.name} × {i.qty}</span><span><Currency amount={i.price * i.qty} /></span>
              </div>
            ))
          )}
          <div className="summary-row"><span>Delivery</span><span>{deliveryFee ? '50 ฿' : 'Free (pickup)'}</span></div>
          <div className="summary-row total"><span>Total</span><span><Currency amount={total} /></span></div>
        </div>
      </div>
    </div>
  );
}

function Track({ goHome }) {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState([]);
  const [looked, setLooked] = useState(false);
  const search = async () => {
    const res = await fetch(API + '/orders?phone=' + encodeURIComponent(phone));
    setOrders(await res.json());
    setLooked(true);
  };
  return (
    <div className="page center">
      <h2>Track your order</h2>
      <p className="muted">Enter the phone number used when ordering.</p>
      <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
      <button className="btn btn-primary" onClick={search}>Search</button>
      {looked && orders.length === 0 && <p className="muted">No orders found for this phone number.</p>}
      <div className="orders-list">
        {orders.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="order-head"><strong>Order #{o.number}</strong><span className={'status ' + o.status}>{o.status}</span></div>
            <div className="order-items">{o.items.map((it, i) => <div key={i}>{it.name} × {it.qty}</div>)}</div>
            <div className="order-foot"><span>Total: <Currency amount={o.total} /></span><span className="muted">{fmtDate(o.createdAt)}</span></div>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" onClick={goHome}>Back to Menu</button>
    </div>
  );
}

// ======================== STAFF PORTAL ========================

function StaffLogin({ onLogin }) {
  const [key, setKey] = useState(localStorage.getItem('jiya_admin_key') || '');
  return (
    <div className="page center portal-login">
      <h2>🏪 Staff Portal</h2>
      <p className="muted">Internal operations — orders, tasks, inventory, reminders & proof.</p>
      <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" />
      <button className="btn btn-primary" onClick={() => { localStorage.setItem('jiya_admin_key', key); onLogin(); }}>Login</button>
      <p className="muted">Default key: <code>jiya-admin-2024</code></p>
    </div>
  );
}

function Dashboard({ orders, tasks, futureOrders, staff, notifications, goTab, updateTask }) {
  const pendingOrders = orders.filter((o) => ['pending', 'preparing'].includes(o.status));
  const myTasks = tasks.filter((t) => t.status !== 'done');
  const upcoming = futureOrders.filter((f) => f.status !== 'completed');
  const unread = notifications.filter((n) => !n.read).length;

  const today = new Date().toDateString();
  const dueToday = futureOrders.filter((f) => new Date(f.dueAt).toDateString() === today && f.status !== 'completed');

  return (
    <div className="portal-dashboard">
      <div className="stats">
        <div className="stat"><span>Orders to prepare</span><strong>{pendingOrders.length}</strong></div>
        <div className="stat"><span>Open tasks</span><strong>{myTasks.length}</strong></div>
        <div className="stat"><span>Upcoming orders</span><strong>{upcoming.length}</strong></div>
        <div className="stat"><span>Unread alerts</span><strong>{unread}</strong></div>
        <div className="stat"><span>Staff</span><strong>{staff.length}</strong></div>
      </div>

      {dueToday.length > 0 && (
        <div className="panel">
          <h3>⚠️ Due today</h3>
          {dueToday.map((f) => (
            <div className="reminder-line" key={f.id}>
              <span>📅 <strong>{f.title}</strong> {f.customerName ? `· ${f.customerName}` : ''} at {new Date(f.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <button className="btn btn-sm" onClick={() => goTab('future')}>Open</button>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-head"><h3>🛒 Prepare these orders</h3><button className="btn btn-sm" onClick={() => goTab('orders')}>All →</button></div>
          {pendingOrders.length === 0 && <p className="muted">No orders waiting.</p>}
          {pendingOrders.slice(0, 5).map((o) => (
            <div className="reminder-line" key={o.id}>
              <span><strong>#{o.number}</strong> {o.customer.name} · <Currency amount={o.total} /></span>
              <span className={'status ' + o.status}>{o.status}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-head"><h3>✅ Assigned tasks</h3><button className="btn btn-sm" onClick={() => goTab('tasks')}>All →</button></div>
          {myTasks.length === 0 && <p className="muted">No open tasks.</p>}
          {myTasks.slice(0, 5).map((t) => {
            const who = staff.find((s) => s.id === t.assigneeId);
            return (
              <div className="reminder-line" key={t.id}>
                <span><strong>{t.title}</strong> {who ? `· ${who.name}` : ''}</span>
                <button className="btn btn-sm" onClick={() => updateTask(t.id, { status: 'done' })}>Done</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, staff, onStatus, onPhotos, onToggleAssign, staffList }) {
  const [photos, setPhotos] = useState(order.photos || []);
  const photoAdd = (url) => {
    const next = [...photos, url];
    setPhotos(next);
    onPhotos(order.id, next);
  };
  const photoRemove = (url) => {
    const next = photos.filter((p) => p !== url);
    setPhotos(next);
    onPhotos(order.id, next);
  };
  const assignee = staff.find((s) => s.id === order.assigneeId);

  return (
    <div className="order-card admin-order">
      <div className="order-head">
        <strong>Order #{order.number}</strong>
        <span className={'status ' + order.status}>{order.status}</span>
      </div>
      <div className="muted">{order.customer.name} · {order.customer.phone} {order.customer.address ? '· ' + order.customer.address : ''}</div>
      <div className="order-items">
        {order.items.map((it, i) => (
          <div key={i}>• {it.name} × {it.qty} — <Currency amount={it.unitPrice * it.qty} /></div>
        ))}
      </div>
      {order.paymentMethod && <div className="muted">Payment: {order.paymentMethod} · <Currency amount={order.total} /></div>}
      <div className="order-assign">
        <span>Assigned to:</span>
        <select className="input input-sm" value={order.assigneeId || ''} onChange={(e) => onToggleAssign(order.id, e.target.value || null)}>
          <option value="">— unassigned —</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {assignee && <span className="staff-chip" style={{ background: assignee.color }}>{assignee.name}</span>}
      </div>
      <PhotoStrip photos={photos} onRemove={photoRemove} />
      <div className="order-foot">
        <div className="status-actions">
          {ORDER_STATUS.map((st) => (
            <button key={st} className={'btn btn-sm ' + (order.status === st ? 'btn-active' : '')} onClick={() => onStatus(order.id, st)}>{st}</button>
          ))}
        </div>
        <PhotoUpload onUploaded={photoAdd} multiple />
      </div>
    </div>
  );
}

function OrdersPanel({ orders, staff, onStatus, onPhotos, onToggleAssign }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  return (
    <div>
      <div className="tabs">
        {['all', ...ORDER_STATUS].map((s) => (
          <button key={s} className={'tab ' + (filter === s ? 'active' : '')} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s} {s !== 'all' ? `(${orders.filter((o) => o.status === s).length})` : `(${orders.length})`}
          </button>
        ))}
      </div>
      <div className="orders-list">
        {filtered.length === 0 && <p className="muted">No orders here.</p>}
        {filtered.map((o) => (
          <OrderCard key={o.id} order={o} staff={staff} onStatus={onStatus} onPhotos={onPhotos} onToggleAssign={onToggleAssign} staffList={staff} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, staff, onUpdate }) {
  const [photos, setPhotos] = useState(task.photos || []);
  const [status, setStatus] = useState(task.status);
  const who = staff.find((s) => s.id === task.assigneeId);
  const photoAdd = (url) => {
    const next = [...photos, url];
    setPhotos(next);
    onUpdate(task.id, { photos: next });
  };
  const photoRemove = (url) => {
    const next = photos.filter((p) => p !== url);
    setPhotos(next);
    onUpdate(task.id, { photos: next });
  };
  const changeStatus = (st) => {
    setStatus(st);
    onUpdate(task.id, { status: st });
  };
  const changeAssignee = (e) => {
    onUpdate(task.id, { assigneeId: e.target.value || null });
  };

  return (
    <div className={'task-card ' + status}>
      <div className="task-head">
        <strong>{task.title}</strong>
        <div className="task-status-btns">
          {TASK_STATUS.map((st) => (
            <button key={st} className={'btn btn-sm ' + (status === st ? 'btn-active' : '')} onClick={() => changeStatus(st)}>{st}</button>
          ))}
        </div>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-meta">
        <select className="input input-sm" value={task.assigneeId || ''} onChange={changeAssignee}>
          <option value="">— assign to —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {who && <span className="staff-chip" style={{ background: who.color }}>{who.name}</span>}
        {task.dueAt && <span className="muted">Due: {fmtDate(task.dueAt)}</span>}
      </div>
      <PhotoStrip photos={photos} onRemove={photoRemove} />
      <PhotoUpload onUploaded={photoAdd} />
    </div>
  );
}

function TasksPanel({ tasks, staff, onUpdate, onCreate }) {
  const [filter, setFilter] = useState('open');
  const filtered = filter === 'all' ? tasks : filter === 'open' ? tasks.filter((t) => t.status !== 'done') : tasks.filter((t) => t.status === filter);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueAt, setDueAt] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    onCreate({ title, description: desc, assigneeId: assigneeId || null, dueAt: dueAt ? new Date(dueAt).toISOString() : null });
    setTitle(''); setDesc(''); setAssigneeId(''); setDueAt('');
  };

  return (
    <div>
      <div className="panel">
        <h3>＋ New task</h3>
        <div className="task-form">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title (e.g. Bake 10 croissants)" />
          <input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Details (optional)" />
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Assign to staff…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <button className="btn btn-primary" onClick={submit}>Create & notify staff</button>
        </div>
      </div>
      <div className="tabs">
        {['open', 'pending', 'in_progress', 'done', 'all'].map((f) => (
          <button key={f} className={'tab ' + (filter === f ? 'active' : '')} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="task-list">
        {filtered.length === 0 && <p className="muted">No tasks.</p>}
        {filtered.map((t) => <TaskCard key={t.id} task={t} staff={staff} onUpdate={onUpdate} />)}
      </div>
    </div>
  );
}

function FutureOrdersPanel({ futureOrders, staff, onUpdate, onCreate, onAssign }) {
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const submit = () => {
    if (!title || !dueAt) return;
    onCreate({ title, customerName, dueAt: new Date(dueAt).toISOString(), notes, assigneeId: assigneeId || null });
    setTitle(''); setCustomerName(''); setDueAt(''); setNotes(''); setAssigneeId('');
  };

  const sorted = [...futureOrders].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));

  return (
    <div>
      <div className="panel">
        <h3>📅 Schedule future order</h3>
        <div className="task-form">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it? (e.g. Wedding cake - 2 tiers)" />
          <input className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" />
          <input className="input" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (flavour, size, special requests)" />
          <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Assign to staff…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={submit}>Schedule & set reminder</button>
        </div>
      </div>

      <div className="future-list">
        {sorted.length === 0 && <p className="muted">No future orders yet.</p>}
        {sorted.map((f) => {
          const who = staff.find((s) => s.id === f.assigneeId);
          const overdue = f.status !== 'completed' && new Date(f.dueAt).getTime() < Date.now();
          return (
            <div className={'future-card ' + (overdue ? 'overdue' : '')} key={f.id}>
              <div className="future-head">
                <div>
                  <strong>{f.title}</strong>
                  {f.customerName && <span className="muted"> · {f.customerName}</span>}
                  {overdue && <span className="badge-overdue">OVERDUE</span>}
                </div>
                <span className={'status ' + f.status}>{f.status}</span>
              </div>
              <div className="future-meta">
                <span>📅 {new Date(f.dueAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <select className="input input-sm" value={f.assigneeId || ''} onChange={(e) => onAssign(f.id, e.target.value || null)}>
                  <option value="">— assign —</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {who && <span className="staff-chip" style={{ background: who.color }}>{who.name}</span>}
              </div>
              {f.notes && <p className="task-desc">{f.notes}</p>}
              <div className="future-actions">
                {FUTURE_STATUS.map((st) => (
                  <button key={st} className={'btn btn-sm ' + (f.status === st ? 'btn-active' : '')} onClick={() => onUpdate(f.id, { status: st })}>{st}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryPanel({ inventory, purchases, onStock, onCreate }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [delta, setDelta] = useState({});
  const [cost, setCost] = useState({});

  const applyStock = async (id, qty, c) => {
    const target = inventory.find((i) => i.id === id);
    await onStock(id, qty, c !== undefined && c !== '' ? c : target.costPerUnit);
    setDelta((d) => ({ ...d, [id]: '' }));
    setCost((c2) => ({ ...c2, [id]: '' }));
  };

  const addItem = () => {
    if (!name) return;
    onCreate({ name, unit, qty: 0, costPerUnit: Number(costPerUnit || 0) });
    setName(''); setUnit('kg'); setCostPerUnit('');
  };

  return (
    <div className="inventory-wrap">
      <div className="panel">
        <h3>＋ New inventory item</h3>
        <div className="task-form">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name (e.g. Vanilla)" />
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" />
          <input className="input" type="number" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} placeholder="Cost per unit ฿" />
          <button className="btn btn-primary" onClick={addItem}>Add item</button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr><th>Item</th><th>In stock</th><th>Unit</th><th>Cost/unit</th><th>Buy / use (enter + or −)</th></tr>
        </thead>
        <tbody>
          {inventory.map((i) => (
            <tr key={i.id}>
              <td><strong>{i.name}</strong></td>
              <td className={i.qty <= 5 ? 'low-stock' : ''}>{i.qty}</td>
              <td>{i.unit}</td>
              <td><Currency amount={i.costPerUnit} /></td>
              <td className="inventory-actions">
                <input className="input input-sm" type="number" value={delta[i.id] ?? ''} onChange={(e) => setDelta((d) => ({ ...d, [i.id]: e.target.value }))} placeholder="+/- qty" />
                <input className="input input-sm" type="number" value={cost[i.id] ?? ''} onChange={(e) => setCost((c) => ({ ...c, [i.id]: e.target.value }))} placeholder="new cost" />
                <button className="btn btn-sm" onClick={() => applyStock(i.id, delta[i.id], cost[i.id])}>Save entry</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">Tip: entering +5 with cost ฿120 records a purchase (money out). Entering −3 records stock used/sold.</p>

      <div className="panel">
        <h3>📋 Purchase & use history</h3>
        <table className="table">
          <thead><tr><th>Type</th><th>Item</th><th>Qty</th><th>Cost/unit</th><th>Total</th><th>Time</th></tr></thead>
          <tbody>
            {[...purchases].reverse().slice(0, 20).map((p) => (
              <tr key={p.id}>
                <td><span className={'status ' + (p.type === 'buy' ? 'completed' : 'cancelled')}>{p.type}</span></td>
                <td>{p.itemName}</td>
                <td>{p.qty}</td>
                <td><Currency amount={p.costPerUnit} /></td>
                <td><Currency amount={p.totalCost} /></td>
                <td className="muted">{fmtDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StaffPanel({ staff, onCreate }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('staff');
  const [phone, setPhone] = useState('');
  const submit = () => {
    if (!name) return;
    onCreate({ name, role, phone });
    setName(''); setRole('staff'); setPhone('');
  };
  return (
    <div className="staff-panel">
      <div className="panel">
        <h3>＋ Add staff member</h3>
        <div className="task-form">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {['owner', 'baker', 'delivery', 'counter', 'staff'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
          <button className="btn btn-primary" onClick={submit}>Add staff</button>
        </div>
      </div>
      <div className="staff-grid">
        {staff.map((s) => (
          <div className="staff-card" key={s.id}>
            <div className="staff-avatar" style={{ background: s.color }}>{s.name[0]}</div>
            <div>
              <strong>{s.name}</strong>
              <div className="muted">{s.role} · {s.phone}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffPortal({ goHome, notify }) {
  const [key, setKey] = useState(localStorage.getItem('jiya_admin_key'));
  const [tab, setTab] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [futureOrders, setFutureOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [staff, setStaff] = useState([]);
  const [ledger, setLedger] = useState([]);

  const loadAll = async () => {
    try {
      const [o, t, f, inv, pu, st, lg] = await Promise.all([
        fetch(API + '/admin/orders', { headers: authHeaders() }),
        fetch(API + '/admin/tasks', { headers: authHeaders() }),
        fetch(API + '/admin/future-orders', { headers: authHeaders() }),
        fetch(API + '/admin/inventory', { headers: authHeaders() }),
        fetch(API + '/admin/purchases', { headers: authHeaders() }),
        fetch(API + '/admin/staff', { headers: authHeaders() }),
        fetch(API + '/admin/ledger', { headers: authHeaders() })
      ]);
      if (o.status === 401 || t.status === 401) {
        localStorage.removeItem('jiya_admin_key');
        setKey(null);
        return;
      }
      setOrders(await o.json());
      setTasks(await t.json());
      setFutureOrders(await f.json());
      setInventory(await inv.json());
      setPurchases(await pu.json());
      setStaff(await st.json());
      setLedger(await lg.json());
    } catch (_) {}
  };

  useEffect(() => { if (key) loadAll(); }, [key]);
  useEffect(() => { if (key) { const t = setInterval(loadAll, 15000); return () => clearInterval(t); } }, [key]);

  const api = async (url, method = 'GET', body = null) => {
    const res = await fetch(API + url, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const createTask = async (t) => { await api('/admin/tasks', 'POST', t); loadAll(); notify.refresh(); };
  const updateTask = async (id, t) => { await api('/admin/tasks/' + id, 'PUT', t); loadAll(); notify.refresh(); };
  const createFuture = async (f) => { await api('/admin/future-orders', 'POST', f); loadAll(); notify.refresh(); };
  const updateFuture = async (id, f) => { await api('/admin/future-orders/' + id, 'PUT', f); loadAll(); notify.refresh(); };
  const setOrderStatus = async (id, status) => { await api('/admin/orders/' + id, 'PUT', { status }); loadAll(); notify.refresh(); };
  const setOrderPhotos = async (id, photos) => { await api('/admin/orders/' + id, 'PUT', { photos }); };
  const setOrderAssign = async (id, assigneeId) => { await api('/admin/orders/' + id, 'PUT', { assigneeId }); loadAll(); };
  const stockChange = async (id, qty, costPerUnit) => { await api('/admin/inventory/' + id + '/stock', 'POST', { qty: Number(qty), costPerUnit: Number(costPerUnit) }); loadAll(); notify.refresh(); };
  const createInv = async (i) => { await api('/admin/inventory', 'POST', i); loadAll(); };
  const createStaff = async (s) => { await api('/admin/staff', 'POST', s); loadAll(); notify.refresh(); };

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const spent = purchases.reduce((s, p) => s + (p.totalCost || 0), 0);

  if (!key) {
    return <StaffLogin onLogin={() => setKey(localStorage.getItem('jiya_admin_key'))} />;
  }

  return (
    <div className="portal">
      <div className="portal-topbar">
        <div className="portal-title">
          <span className="brand-logo">🎂</span>
          <div>
            <h1>Jiya's Delight — Staff Portal</h1>
            <span className="muted">Internal operations · Bangkok</span>
          </div>
        </div>
        <div className="portal-top-actions">
          <span className="muted">Revenue <strong><Currency amount={revenue} /></strong> · Spent <strong><Currency amount={spent} /></strong></span>
          <NotificationBell n={notify} markRead={notify.markRead} />
          <button className="btn btn-ghost btn-sm" onClick={() => goHome()}>← Storefront</button>
          <button className="btn btn-sm" onClick={() => { localStorage.removeItem('jiya_admin_key'); setKey(null); }}>Log out</button>
        </div>
      </div>

      <div className="portal-nav">
        {[
          ['dashboard', '📊 Dashboard'],
          ['orders', '🛒 Orders'],
          ['tasks', '✅ To-Do List'],
          ['future', '📅 Future Orders'],
          ['inventory', '📦 Buy/Sell Inventory'],
          ['staff', '👥 Staff'],
          ['ledger', '💸 Ledger']
        ].map(([id, label]) => (
          <button key={id} className={'tab ' + (tab === id ? 'active' : '')} onClick={() => setTab(id)}>
            {label}
            {id === 'orders' && orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length > 0 && (
              <span className="tab-count">{orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="page portal-body">
        {tab === 'dashboard' && <Dashboard orders={orders} tasks={tasks} futureOrders={futureOrders} staff={staff} notifications={notify.notifications} goTab={setTab} updateTask={updateTask} />}
        {tab === 'orders' && <OrdersPanel orders={orders} staff={staff} onStatus={setOrderStatus} onPhotos={setOrderPhotos} onToggleAssign={setOrderAssign} />}
        {tab === 'tasks' && <TasksPanel tasks={tasks} staff={staff} onUpdate={updateTask} onCreate={createTask} />}
        {tab === 'future' && <FutureOrdersPanel futureOrders={futureOrders} staff={staff} onUpdate={updateFuture} onCreate={createFuture} onAssign={(id, a) => updateFuture(id, { assigneeId: a })} />}
        {tab === 'inventory' && <InventoryPanel inventory={inventory} purchases={purchases} onStock={stockChange} onCreate={createInv} />}
        {tab === 'staff' && <StaffPanel staff={staff} onCreate={createStaff} />}
        {tab === 'ledger' && (
          <div className="panel">
            <h3>💸 Ledger (all money)</h3>
            <table className="table">
              <thead><tr><th>Type</th><th>Amount</th><th>Note</th><th>Time</th></tr></thead>
              <tbody>
                {[...ledger].reverse().map((l) => (
                  <tr key={l.id}>
                    <td><span className={'status ' + (l.type === 'order' ? 'completed' : l.type === 'purchase' ? 'cancelled' : 'preparing')}>{l.type}</span></td>
                    <td><Currency amount={l.amount} /></td>
                    <td>{l.note}</td>
                    <td className="muted">{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [view, setView] = useState('home');
  const cartState = useCart();
  const [checkoutInfo, setCheckoutInfo] = useState(null);
  const notif = useNotifications();

  useEffect(() => {
    fetch(API + '/products').then((r) => r.json()).then(setProducts).catch(() => {});
  }, []);

  const goCheckout = (info) => { setCheckoutInfo(info); setView('checkout'); };
  const doneOrder = () => { cartState.clear(); setCheckoutInfo(null); setView('home'); };

  return (
    <div className="app">
      {view === 'portal' ? (
        <StaffPortal goHome={() => setView('home')} notify={notif} />
      ) : (
        <>
          <Header cart={cartState.cart} onCartClick={(v) => setView(v)} onTrack={() => setView('track')} onAdmin={() => setView('portal')} notif={notif} markRead={notif.markRead} />
          {view === 'home' && <Home products={products} onAdd={cartState.add} cart={cartState.cart} onCartClick={(v) => setView(v)} />}
          {view === 'custom' && <CustomCake onCheckout={goCheckout} />}
          {view === 'cart' && (
            <Cart cart={cartState.cart} setQty={cartState.setQty} remove={cartState.remove} subtotal={cartState.subtotal}
              onCheckout={(info) => goCheckout({ ...info, customItemsSubtotal: cartState.subtotal })} />
          )}
          {view === 'checkout' && (
            <Checkout cart={checkoutInfo?.items || []}
              customCake={checkoutInfo?.customCake ? { customCake: checkoutInfo.customCake, total: checkoutInfo.total, label: checkoutInfo.label } : null}
              deliveryFee={checkoutInfo?.deliveryFee || 0} subtotal={checkoutInfo?.customItemsSubtotal ?? cartState.subtotal} goHome={doneOrder} />
          )}
          {view === 'track' && <Track goHome={() => setView('home')} />}
        </>
      )}
    </div>
  );
}

function useCart() {
  const [cart, setCart] = useState([]);
  const add = (product) => {
    setCart((c) => {
      const found = c.find((x) => x.productId === product.id);
      if (found) return c.map((x) => (x.productId === product.id ? { ...x, qty: x.qty + 1 } : x));
      return [...c, { productId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };
  const remove = (productId) => setCart((c) => c.filter((x) => x.productId !== productId));
  const setQty = (productId, qty) =>
    setCart((c) => (qty <= 0 ? c.filter((x) => x.productId !== productId) : c.map((x) => (x.productId === productId ? { ...x, qty } : x))));
  const clear = () => setCart([]);
  const subtotal = cart.reduce((s, x) => s + x.price * x.qty, 0);
  return { cart, add, remove, setQty, clear, subtotal };
}

export default App;
