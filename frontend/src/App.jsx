import { useEffect, useState } from 'react';

const API = '/api';

const CATEGORY_LABELS = {
  cake: 'Cakes',
  bread: 'Bread',
  pastry: 'Pastries',
  savory: 'Savory'
};

const PAYMENT_METHODS = [
  { id: 'promptpay', label: 'PromptPay (QR)', hint: 'Scan QR with any Thai bank app' },
  { id: 'cash', label: 'Cash on Delivery', hint: 'Pay in THB when order arrives' },
  { id: 'transfer', label: 'Bank Transfer', hint: 'Transfer to our bank account' }
];

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

function Currency({ amount }) {
  return (
    <span>
      {Number(amount).toLocaleString('en-US')} ฿
    </span>
  );
}

function Header({ cart, onCartClick, onTrack, onAdmin }) {
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
          <button onClick={() => onTrack()}>Track Order</button>
          <button onClick={() => onAdmin()}>Staff</button>
          <button className="cart-btn" onClick={() => onCartClick('cart')}>
            🛒 <span className="cart-count">{count}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}

function ProductCard({ product, onAdd }) {
  return (
    <div className="product-card">
      <div className="product-emoji">
        {product.category === 'cake' ? '🎂' : product.category === 'bread' ? '🍞' : product.category === 'pastry' ? '🥐' : '🥪'}
      </div>
      <div className="product-cat">{CATEGORY_LABELS[product.category] || product.category}</div>
      <h3 className="product-name">{product.name}</h3>
      <p className="product-desc">{product.description}</p>
      <div className="product-foot">
        <span className="product-price">
          <Currency amount={product.price} />
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => onAdd(product)}>
          Add
        </button>
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
        <button className="btn btn-light" onClick={() => onCartClick('custom')}>
          Order a Custom Cake
        </button>
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
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} onAdd={onAdd} />
          ))}
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
              <button key={f} className={'flavour-btn ' + (flavour === f ? 'active' : '')} onClick={() => setFlavour(f)}>
                {f}
              </button>
            ))}
          </div>
          <h3>Message on cake (optional)</h3>
          <input className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Happy Birthday!" maxLength={40} />
          <div className="custom-total">
            Total: <Currency amount={sizeObj.price} />
          </div>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => onCheckout({ customCake: { size, flavour, message }, total: sizeObj.price, label: `Custom Cake (${size}) - ${flavour}` })}
          >
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
      <div className="page center">
        <h2>Your cart is empty</h2>
        <p>Add some treats from the menu!</p>
      </div>
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
                <span>
                  <Currency amount={item.price} /> each
                </span>
              </div>
              <div className="qty-control">
                <button onClick={() => setQty(item.productId, item.qty - 1)}>−</button>
                <span>{item.qty}</span>
                <button onClick={() => setQty(item.productId, item.qty + 1)}>+</button>
              </div>
              <span className="cart-item-total">
                <Currency amount={item.price * item.qty} />
              </span>
              <button className="remove-btn" onClick={() => remove(item.productId)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="summary">
          <h3>Summary</h3>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>
              <Currency amount={subtotal} />
            </span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <label className="switch">
              <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
              <span className="switch-slider" />
            </label>
            <span>{delivery ? '50 ฿' : 'Pickup'}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>
              <Currency amount={subtotal + deliveryFee} />
            </span>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => onCheckout({ items: cart, deliveryFee })}>
            Checkout
          </button>
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
      const body = {
        customer: { name, phone, address },
        paymentMethod: method,
        deliveryFee: deliveryFee || 0
      };
      if (customCake) body.customCake = customCake.customCake;
      else body.items = cart.map((c) => ({ productId: c.productId, qty: c.qty }));
      const res = await fetch(API + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
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
          <label className="field">
            <span>Name *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </label>
          <label className="field">
            <span>Phone (TH) *</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08x-xxx-xxxx" />
          </label>
          <label className="field">
            <span>Address</span>
            <textarea className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address (Bangkok)" rows={2} />
          </label>
          <h3>Payment (THB)</h3>
          <div className="methods">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.id} className={'method ' + (method === m.id ? 'active' : '')} onClick={() => setMethod(m.id)}>
                <strong>{m.label}</strong>
                <small>{m.hint}</small>
              </button>
            ))}
          </div>
          {method === 'promptpay' && (
            <div className="qr-note">
              <strong>Scan & pay</strong>
              <div className="qr-box">081-234-5678</div>
              <small className="muted">Your PromptPay QR will be shown by our staff when your order is ready. Payment auto-recorded as received.</small>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-lg" onClick={place} disabled={placing}>
            {placing ? 'Placing order...' : `Pay ${total} ฿ & Confirm`}
          </button>
        </div>
        <div className="summary">
          <h3>Order summary</h3>
          {customCake ? (
            <div className="cart-item">
              <strong>{customCake.label}</strong>
              <span>
                <Currency amount={customCake.total} />
              </span>
            </div>
          ) : (
            cart.map((i) => (
              <div className="cart-item" key={i.productId}>
                <span>
                  {i.name} × {i.qty}
                </span>
                <span>
                  <Currency amount={i.price * i.qty} />
                </span>
              </div>
            ))
          )}
          <div className="summary-row">
            <span>Delivery</span>
            <span>{deliveryFee ? '50 ฿' : 'Free (pickup)'}</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>
              <Currency amount={total} />
            </span>
          </div>
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
    const data = await res.json();
    setOrders(data);
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
            <div className="order-head">
              <strong>Order #{o.number}</strong>
              <span className={'status ' + o.status}>{o.status}</span>
            </div>
            <div className="order-items">
              {o.items.map((it, i) => (
                <div key={i}>
                  {it.name} × {it.qty}
                </div>
              ))}
            </div>
            <div className="order-foot">
              <span>
                Total: <Currency amount={o.total} />
              </span>
              <span className="muted">{new Date(o.createdAt).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" onClick={goHome}>Back to Menu</button>
    </div>
  );
}

function Admin({ goHome }) {
  const [key, setKey] = useState(localStorage.getItem('jiya_admin_key') || '');
  const [authed, setAuthed] = useState(!!localStorage.getItem('jiya_admin_key'));
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [tab, setTab] = useState('orders');
  const [purchases, setPurchases] = useState([]);

  const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-key': key });

  const loadAll = async () => {
    const [pr, inv, or, lg, pu] = await Promise.all([
      fetch(API + '/admin/products', { headers: headers() }),
      fetch(API + '/admin/inventory', { headers: headers() }),
      fetch(API + '/admin/orders', { headers: headers() }),
      fetch(API + '/admin/ledger', { headers: headers() }),
      fetch(API + '/admin/purchases', { headers: headers() })
    ]);
    if (pr.status === 401 || inv.status === 401) {
      setAuthed(false);
      localStorage.removeItem('jiya_admin_key');
      return;
    }
    setProducts(await pr.json());
    setInventory(await inv.json());
    setOrders(await or.json());
    setLedger(await lg.json());
    setPurchases(await pu.json());
  };

  const login = () => {
    localStorage.setItem('jiya_admin_key', key);
    setAuthed(true);
    loadAll();
  };

  useEffect(() => {
    if (authed) loadAll();
  }, [authed]);

  const updateStock = async (id, qty, costPerUnit) => {
    await fetch(API + '/admin/inventory/' + id + '/stock', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ qty: Number(qty), costPerUnit: costPerUnit ? Number(costPerUnit) : undefined })
    });
    loadAll();
  };

  const setOrderStatus = async (id, status) => {
    await fetch(API + '/admin/orders/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify({ status }) });
    loadAll();
  };

  const addProduct = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const body = {
      name: form.get('name'),
      category: form.get('category'),
      description: form.get('description'),
      price: Number(form.get('price')),
      stock: Number(form.get('stock') || 0),
      unit: form.get('unit')
    };
    await fetch(API + '/admin/products', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    e.target.reset();
    loadAll();
  };

  if (!authed) {
    return (
      <div className="page center">
        <h2>Staff Login</h2>
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" />
        <button className="btn btn-primary" onClick={login}>Login</button>
        <p className="muted">Default key: <code>jiya-admin-2024</code></p>
        <button className="btn btn-ghost" onClick={goHome}>Back to Menu</button>
      </div>
    );
  }

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalSpend = purchases.reduce((s, p) => s + (p.totalCost || 0), 0);
  const inventoryValue = inventory.reduce((s, i) => s + i.qty * i.costPerUnit, 0);

  return (
    <div className="page">
      <div className="admin-head">
        <h2>Staff Dashboard</h2>
        <button className="btn btn-ghost" onClick={() => { setAuthed(false); localStorage.removeItem('jiya_admin_key'); goHome(); }}>Log out</button>
      </div>
      <div className="stats">
        <div className="stat"><span>Revenue (orders)</span><strong><Currency amount={totalRevenue} /></strong></div>
        <div className="stat"><span>Spent (buy)</span><strong><Currency amount={totalSpend} /></strong></div>
        <div className="stat"><span>Inventory value</span><strong><Currency amount={inventoryValue} /></strong></div>
        <div className="stat"><span>Orders</span><strong>{orders.length}</strong></div>
      </div>
      <div className="tabs">
        {['orders', 'inventory', 'products', 'ledger'].map((t) => (
          <button key={t} className={'tab ' + (tab === t ? 'active' : '')} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div className="orders-list">
          {orders.map((o) => (
            <div className="order-card admin-order" key={o.id}>
              <div className="order-head">
                <strong>Order #{o.number}</strong>
                <span className={'status ' + o.status}>{o.status}</span>
              </div>
              <div className="muted">{o.customer.name} · {o.customer.phone}</div>
              <div className="order-items">
                {o.items.map((it, i) => (
                  <div key={i}>{it.name} × {it.qty} — <Currency amount={it.unitPrice * it.qty} /></div>
                ))}
              </div>
              <div className="order-foot">
                <span>Total: <Currency amount={o.total} /> · {o.paymentMethod}</span>
                <div className="status-actions">
                  <button className="btn btn-sm" onClick={() => setOrderStatus(o.id, 'preparing')}>Preparing</button>
                  <button className="btn btn-sm" onClick={() => setOrderStatus(o.id, 'ready')}>Ready</button>
                  <button className="btn btn-sm" onClick={() => setOrderStatus(o.id, 'completed')}>Done</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'inventory' && (
        <div>
          <table className="table">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Cost/unit</th><th>Buy / Sell stock</th></tr>
            </thead>
            <tbody>
              {inventory.map((i) => (
                <InventoryRow key={i.id} item={i} onUpdate={updateStock} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'products' && (
        <div className="products-admin">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td><Currency amount={p.price} /></td>
                  <td>{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="form add-form" onSubmit={addProduct}>
            <h3>Add product</h3>
            <input className="input" name="name" placeholder="Name" required />
            <select className="input" name="category">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input className="input" name="description" placeholder="Description" />
            <div className="row2">
              <input className="input" name="price" type="number" placeholder="Price ฿" required />
              <input className="input" name="stock" type="number" placeholder="Stock" />
            </div>
            <input className="input" name="unit" placeholder="Unit (piece/loaf/whole)" />
            <button className="btn btn-primary">Add product</button>
          </form>
        </div>
      )}

      {tab === 'ledger' && (
        <table className="table">
          <thead>
            <tr><th>Type</th><th>Amount</th><th>Note</th><th>Time</th></tr>
          </thead>
          <tbody>
            {[...ledger].reverse().map((l) => (
              <tr key={l.id}>
                <td className={l.type}>{l.type}</td>
                <td><Currency amount={l.amount} /></td>
                <td>{l.note}</td>
                <td className="muted">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function InventoryRow({ item, onUpdate }) {
  const [delta, setDelta] = useState('');
  const [cost, setCost] = useState('');
  return (
    <tr>
      <td>{item.name}</td>
      <td>{item.qty}</td>
      <td>{item.unit}</td>
      <td><Currency amount={item.costPerUnit} /></td>
      <td className="inventory-actions">
        <input className="input input-sm" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="+/- qty" />
        <input className="input input-sm" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="cost/unit" />
        <button className="btn btn-sm" onClick={() => { onUpdate(item.id, delta, cost); setDelta(''); setCost(''); }}>Save</button>
      </td>
    </tr>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [view, setView] = useState('home');
  const [cartState, setCartState] = useCart();
  const [checkoutInfo, setCheckoutInfo] = useState(null);

  useEffect(() => {
    fetch(API + '/products').then((r) => r.json()).then(setProducts).catch(() => {});
  }, []);

  const goCheckout = (info) => {
    setCheckoutInfo(info);
    setView('checkout');
  };

  const doneOrder = () => {
    setCartState.clear();
    setCheckoutInfo(null);
    setView('home');
  };

  return (
    <div className="app">
      <Header cart={cartState.cart} onCartClick={(v) => setView(v)} onTrack={() => setView('track')} onAdmin={() => setView('admin')} />
      {view === 'home' && <Home products={products} onAdd={cartState.add} cart={cartState.cart} onCartClick={(v) => setView(v)} />}
      {view === 'custom' && <CustomCake onCheckout={goCheckout} />}
      {view === 'cart' && (
        <Cart
          cart={cartState.cart}
          setQty={cartState.setQty}
          remove={cartState.remove}
          subtotal={cartState.subtotal}
          onCheckout={(info) => goCheckout({ ...info, customItemsSubtotal: cartState.subtotal })}
        />
      )}
      {view === 'checkout' && (
        <Checkout
          cart={checkoutInfo?.items || []}
          customCake={checkoutInfo?.customCake ? { customCake: checkoutInfo.customCake, total: checkoutInfo.total, label: checkoutInfo.label } : null}
          deliveryFee={checkoutInfo?.deliveryFee || 0}
          subtotal={checkoutInfo?.customItemsSubtotal ?? cartState.subtotal}
          goHome={doneOrder}
        />
      )}
      {view === 'track' && <Track goHome={() => setView('home')} />}
      {view === 'admin' && <Admin goHome={() => setView('home')} />}
    </div>
  );
}

export default App;
