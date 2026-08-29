import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Store } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const store = new Store();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function mkId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function publicProduct(p) {
  const { stock, ...rest } = p;
  return rest;
}

function respond(cb, res) {
  try {
    cb();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function authAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  const ADMIN_KEY = process.env.ADMIN_KEY || 'jiya-admin-2024';
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ---------- Public API ----------

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/products', (req, res) => {
  respond(() => {
    const { category } = req.query;
    let list = store.db.products.filter((p) => p.active !== false);
    if (category) list = list.filter((p) => p.category === category);
    res.json(list.map(publicProduct));
  }, res);
});

app.get('/api/categories', (req, res) => {
  respond(() => {
    const cats = {};
    store.db.products.forEach((p) => {
      cats[p.category] = (cats[p.category] || 0) + 1;
    });
    res.json(Object.keys(cats).map((k) => ({ name: k, count: cats[k] })));
  }, res);
});

app.post('/api/orders', (req, res) => {
  respond(() => {
    const { customer, items, deliveryFee = 0, paymentMethod = 'cash', customCake } = req.body || {};
    if (!customer || !customer.name || !customer.phone) {
      return res.status(400).json({ error: 'Customer name and phone are required' });
    }
    if ((!items || items.length === 0) && !customCake) {
      return res.status(400).json({ error: 'Order must contain at least one item' });
    }

    const orderItems = [];
    let subtotal = 0;

    if (customCake) {
      const cc = customCake;
      const sizePrice = { small: 650, medium: 950, large: 1400 };
      const price = sizePrice[cc.size] || 950;
      orderItems.push({
        productId: 'custom-cake',
        name: `Custom Cake (${cc.size}) - ${cc.flavour}`,
        qty: 1,
        unitPrice: price,
        detail: cc.message ? `Message: ${cc.message}` : undefined
      });
      subtotal += price;
    }

    if (items) {
      for (const it of items) {
        const prod = store.db.products.find((p) => p.id === it.productId);
        if (!prod) return res.status(400).json({ error: 'Product not found: ' + it.productId });
        const qty = Number(it.qty) || 1;
        if (prod.stock < qty) {
          return res.status(400).json({ error: `Not enough stock for ${prod.name} (only ${prod.stock} left)` });
        }
        prod.stock -= qty;
        orderItems.push({ productId: prod.id, name: prod.name, qty, unitPrice: prod.price });
        subtotal += prod.price * qty;
      }
    }

    const total = subtotal + Number(deliveryFee || 0);
    const number = store.db.orders.length + 1;
    const order = {
      id: mkId('ORD'),
      number,
      customer: { name: customer.name, phone: customer.phone, address: customer.address || '' },
      items: orderItems,
      subtotal,
      deliveryFee: Number(deliveryFee || 0),
      total,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    store.db.orders.push(order);
    store.addLedger('order', total, `Order #${number} - ${customer.name}`, order.id);
    store.save();
    res.status(201).json(order);
  }, res);
});

app.get('/api/orders/:id', (req, res) => {
  respond(() => {
    const order = store.db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  }, res);
});

app.get('/api/orders', (req, res) => {
  respond(() => {
    const { phone } = req.query;
    let list = [...store.db.orders];
    if (phone) list = list.filter((o) => o.customer.phone === phone);
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  }, res);
});

// ---------- Admin API (protected) ----------

app.get('/api/admin/products', authAdmin, (req, res) => {
  respond(() => res.json(store.db.products), res);
});

app.post('/api/admin/products', authAdmin, (req, res) => {
  respond(() => {
    const p = req.body;
    if (!p.name || !p.price) return res.status(400).json({ error: 'name and price required' });
    const product = {
      id: mkId('p'),
      category: p.category || 'cake',
      description: p.description || '',
      price: Number(p.price),
      unit: p.unit || 'piece',
      stock: Number(p.stock || 0),
      active: p.active !== false,
      name: p.name
    };
    store.db.products.push(product);
    store.save();
    res.status(201).json(product);
  }, res);
});

app.put('/api/admin/products/:id', authAdmin, (req, res) => {
  respond(() => {
    const prod = store.db.products.find((x) => x.id === req.params.id);
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    Object.assign(prod, req.body, { price: req.body.price ? Number(req.body.price) : prod.price });
    store.save();
    res.json(prod);
  }, res);
});

app.get('/api/admin/inventory', authAdmin, (req, res) => {
  respond(() => res.json(store.db.inventory), res);
});

app.post('/api/admin/inventory', authAdmin, (req, res) => {
  respond(() => {
    const { name, unit = 'kg', qty = 0, costPerUnit = 0 } = req.body;
    const item = { id: mkId('inv'), name, unit, qty: Number(qty), costPerUnit: Number(costPerUnit) };
    store.db.inventory.push(item);
    store.save();
    res.status(201).json(item);
  }, res);
});

app.post('/api/admin/inventory/:id/stock', authAdmin, (req, res) => {
  respond(() => {
    const item = store.db.inventory.find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const delta = Number(req.body.qty || 0);
    const costPerUnit = req.body.costPerUnit ? Number(req.body.costPerUnit) : item.costPerUnit;
    item.qty += delta;
    if (req.body.costPerUnit) item.costPerUnit = costPerUnit;

    const purchase = {
      id: mkId('PUR'),
      itemId: item.id,
      itemName: item.name,
      qty: delta,
      costPerUnit,
      totalCost: delta * costPerUnit,
      type: delta >= 0 ? 'buy' : 'sell',
      createdAt: new Date().toISOString()
    };
    store.db.purchases.push(purchase);
    if (delta > 0) store.addLedger('purchase', delta * costPerUnit, `Bought ${item.name}`, purchase.id);
    else if (delta < 0) store.addLedger('sale', Math.abs(delta) * costPerUnit, `Sold ${item.name}`, purchase.id);
    store.save();
    res.json(item);
  }, res);
});

app.get('/api/admin/purchases', authAdmin, (req, res) => {
  respond(() => res.json(store.db.purchases), res);
});

app.get('/api/admin/ledger', authAdmin, (req, res) => {
  respond(() => res.json(store.db.ledger), res);
});

app.get('/api/admin/orders', authAdmin, (req, res) => {
  respond(() => {
    const list = [...store.db.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  }, res);
});

app.put('/api/admin/orders/:id', authAdmin, (req, res) => {
  respond(() => {
    const order = store.db.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = req.body.status || order.status;
    order.paymentMethod = req.body.paymentMethod || order.paymentMethod;
    store.save();
    res.json(order);
  }, res);
});

// Serve static built frontend if present
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`[Jiya's Delight] backend running on http://localhost:${PORT}`);
});
