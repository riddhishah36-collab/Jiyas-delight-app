import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { Store } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const store = new Store();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, 'photo-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

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
    store.notify('order', `New order #${number} from ${customer.name}. ${orderItems.length} item(s), ${total} THB. Start preparing!`, order.id);
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
    const prevStatus = order.status;
    order.status = req.body.status || order.status;
    order.paymentMethod = req.body.paymentMethod || order.paymentMethod;
    if (req.body.photos) order.photos = req.body.photos;
    if (req.body.assigneeId !== undefined) order.assigneeId = req.body.assigneeId;
    if (order.status !== prevStatus) {
      store.notify('status', `Order #${order.number} is now ${order.status}.`, order.id);
    }
    store.save();
    res.json(order);
  }, res);
});

// ---------- Photo upload (proof) ----------

app.post('/api/upload', authAdmin, upload.single('photo'), (req, res) => {
  respond(() => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  }, res);
});

// ---------- Staff ----------

app.get('/api/admin/staff', authAdmin, (req, res) => {
  respond(() => res.json(store.db.staff), res);
});

app.post('/api/admin/staff', authAdmin, (req, res) => {
  respond(() => {
    const { name, role = 'staff', phone = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const member = {
      id: mkId('st'),
      name,
      role,
      phone,
      color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
    };
    store.db.staff.push(member);
    store.notify('staff', `New staff member added: ${name} (${role})`, member.id);
    store.save();
    res.status(201).json(member);
  }, res);
});

// ---------- Tasks (to-do list, assignable) ----------

app.get('/api/admin/tasks', authAdmin, (req, res) => {
  respond(() => {
    const { assigneeId, status } = req.query;
    let list = [...store.db.tasks];
    if (assigneeId) list = list.filter((t) => t.assigneeId === assigneeId);
    if (status) list = list.filter((t) => t.status === status);
    list.sort((a, b) => new Date(a.dueAt || a.createdAt) - new Date(b.dueAt || b.createdAt));
    res.json(list);
  }, res);
});

app.post('/api/admin/tasks', authAdmin, (req, res) => {
  respond(() => {
    const { title, description = '', assigneeId = null, dueAt = null } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title required' });
    const task = {
      id: mkId('T'),
      title,
      description,
      assigneeId,
      status: 'pending',
      photos: [],
      dueAt,
      createdAt: new Date().toISOString()
    };
    store.db.tasks.push(task);
    const assignee = store.db.staff.find((s) => s.id === assigneeId);
    store.notify('task', `New task assigned: "${title}"` + (assignee ? ` to ${assignee.name}` : ''), task.id, assigneeId);
    store.save();
    res.status(201).json(task);
  }, res);
});

app.put('/api/admin/tasks/:id', authAdmin, (req, res) => {
  respond(() => {
    const task = store.db.tasks.find((t) => t.id === req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const prevStatus = task.status;
    if (req.body.status) task.status = req.body.status;
    if (req.body.title) task.title = req.body.title;
    if (req.body.description !== undefined) task.description = req.body.description;
    if (req.body.assigneeId !== undefined) task.assigneeId = req.body.assigneeId;
    if (req.body.dueAt !== undefined) task.dueAt = req.body.dueAt;
    if (req.body.photos) task.photos = req.body.photos;
    if (req.body.status && req.body.status !== prevStatus) {
      const assignee = store.db.staff.find((s) => s.id === task.assigneeId);
      store.notify('task', `Task "${task.title}" is ${task.status}.` + (assignee ? ` (${assignee.name})` : ''), task.id, task.assigneeId);
    }
    store.save();
    res.json(task);
  }, res);
});

// ---------- Future orders (reminders) ----------

app.get('/api/admin/future-orders', authAdmin, (req, res) => {
  respond(() => {
    const list = [...store.db.futureOrders].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
    res.json(list);
  }, res);
});

app.post('/api/admin/future-orders', authAdmin, (req, res) => {
  respond(() => {
    const { title, customerName = '', dueAt, notes = '', assigneeId = null } = req.body;
    if (!title || !dueAt) return res.status(400).json({ error: 'title and dueAt required' });
    const fo = {
      id: mkId('FO'),
      title,
      customerName,
      dueAt,
      notes,
      assigneeId,
      status: 'scheduled',
      reminded: false,
      createdAt: new Date().toISOString()
    };
    store.db.futureOrders.push(fo);
    store.notify('future', `Future order scheduled: "${title}" for ${new Date(dueAt).toLocaleString()}.`, fo.id, assigneeId);
    store.save();
    res.status(201).json(fo);
  }, res);
});

app.put('/api/admin/future-orders/:id', authAdmin, (req, res) => {
  respond(() => {
    const fo = store.db.futureOrders.find((f) => f.id === req.params.id);
    if (!fo) return res.status(404).json({ error: 'Future order not found' });
    const prevStatus = fo.status;
    if (req.body.status) fo.status = req.body.status;
    if (req.body.title) fo.title = req.body.title;
    if (req.body.notes !== undefined) fo.notes = req.body.notes;
    if (req.body.photos) fo.photos = req.body.photos;
    if (req.body.status && req.body.status !== prevStatus) {
      store.notify('future', `Future order "${fo.title}" marked ${fo.status}.`, fo.id, fo.assigneeId);
    }
    store.save();
    res.json(fo);
  }, res);
});

// ---------- Notifications ----------

app.get('/api/admin/notifications', authAdmin, (req, res) => {
  respond(() => {
    const list = [...store.db.notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unread = store.db.notifications.filter((n) => !n.read).length;
    res.json({ notifications: list, unread });
  }, res);
});

app.post('/api/admin/notifications/read', authAdmin, (req, res) => {
  respond(() => {
    const { id } = req.body;
    if (id) {
      const n = store.db.notifications.find((x) => x.id === id);
      if (n) n.read = true;
    } else {
      store.db.notifications.forEach((n) => { n.read = true; });
    }
    store.save();
    res.json({ ok: true });
  }, res);
});

// Reminder worker: check every 30s for due future orders
setInterval(() => {
  const now = Date.now();
  store.db.futureOrders
    .filter((f) => f.status === 'scheduled' && !f.reminded && new Date(f.dueAt).getTime() <= now)
    .forEach((f) => store.reminderFor(f.id));
}, 30000);

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
