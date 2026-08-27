import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_DB = {
  products: [
    {
      id: 'p-cake-choc',
      name: 'Chocolate Fudge Cake',
      category: 'cake',
      description: 'Rich Belgian chocolate layers with silky ganache.',
      price: 650,
      unit: 'whole',
      stock: 10,
      active: true
    },
    {
      id: 'p-cake-redvelvet',
      name: 'Red Velvet Cake',
      category: 'cake',
      description: 'Classic red velvet with cream cheese frosting.',
      price: 720,
      unit: 'whole',
      stock: 8,
      active: true
    },
    {
      id: 'p-cake-blueberry',
      name: 'Blueberry Cheesecake',
      category: 'cake',
      description: 'Baked cheesecake topped with fresh blueberries.',
      price: 780,
      unit: 'whole',
      stock: 6,
      active: true
    },
    {
      id: 'p-cake-slice',
      name: 'Cake Slice (Any Flavour)',
      category: 'cake',
      description: 'Single generous slice of our signature cakes.',
      price: 95,
      unit: 'slice',
      stock: 40,
      active: true
    },
    {
      id: 'p-bread-sourdough',
      name: 'Sourdough Loaf',
      category: 'bread',
      description: 'Slow-fermented, crusty artisan sourdough.',
      price: 120,
      unit: 'loaf',
      stock: 15,
      active: true
    },
    {
      id: 'p-bread-brioche',
      name: 'Butter Brioche',
      category: 'bread',
      description: 'Soft, golden, buttery brioche loaf.',
      price: 110,
      unit: 'loaf',
      stock: 12,
      active: true
    },
    {
      id: 'p-pastry-croissant',
      name: 'Butter Croissant',
      category: 'pastry',
      description: 'Flaky, airy, all-butter croissant.',
      price: 60,
      unit: 'piece',
      stock: 30,
      active: true
    },
    {
      id: 'p-pastry-pandan',
      name: 'Pandan Custard Bun',
      category: 'pastry',
      description: 'Soft bun filled with pandan custard.',
      price: 45,
      unit: 'piece',
      stock: 25,
      active: true
    },
    {
      id: 'p-savory-thai',
      name: 'Thai Basil Pork Pie',
      category: 'savory',
      description: 'Homestyle pie with Thai basil pork filling.',
      price: 85,
      unit: 'piece',
      stock: 18,
      active: true
    },
    {
      id: 'p-savory-sandwich',
      name: 'Chicken Sandwich',
      category: 'savory',
      description: 'Fresh chicken sandwich with house mayo.',
      price: 90,
      unit: 'piece',
      stock: 15,
      active: true
    }
  ],
  inventory: [
    { id: 'inv-flour', name: 'Flour', unit: 'kg', qty: 50, costPerUnit: 40 },
    { id: 'inv-butter', name: 'Butter', unit: 'kg', qty: 20, costPerUnit: 260 },
    { id: 'inv-sugar', name: 'Sugar', unit: 'kg', qty: 30, costPerUnit: 35 },
    { id: 'inv-eggs', name: 'Eggs', unit: 'dozen', qty: 40, costPerUnit: 95 },
    { id: 'inv-choc', name: 'Chocolate', unit: 'kg', qty: 12, costPerUnit: 380 },
    { id: 'inv-cream', name: 'Fresh Cream', unit: 'litre', qty: 25, costPerUnit: 120 },
    { id: 'inv-fruit', name: 'Fresh Fruit', unit: 'kg', qty: 15, costPerUnit: 90 }
  ],
  orders: [],
  purchases: [],
  ledger: []
};

function now() {
  return new Date().toISOString();
}

export class Store {
  constructor() {
    this.db = null;
    this.gitQueue = [];
    this.gitTimer = null;
    this.load();
    this.seed();
  }

  load() {
    if (fs.existsSync(DATA_FILE)) {
      try {
        this.db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        this.db.orders = this.db.orders || [];
        this.db.purchases = this.db.purchases || [];
        this.db.ledger = this.db.ledger || [];
        this.db.products = this.db.products || [];
        this.db.inventory = this.db.inventory || [];
        return;
      } catch (e) {
        console.error('Data file corrupt, creating backup and starting fresh', e);
        try {
          fs.copyFileSync(DATA_FILE, DATA_FILE + '.corrupt.' + Date.now());
        } catch (_) {}
      }
    }
    this.db = JSON.parse(JSON.stringify(DEFAULT_DB));
    this.save(true);
  }

  seed() {
    if (this.db.orders.length > 0) return;
    const sample = {
      id: 'ORD-' + Date.now().toString(36).toUpperCase(),
      number: 1,
      customer: { name: 'Sample Order', phone: '080-000-0000' },
      items: [{ productId: 'p-cake-choc', name: 'Chocolate Fudge Cake', qty: 1, unitPrice: 650 }],
      subtotal: 650,
      deliveryFee: 50,
      total: 700,
      paymentMethod: 'cash',
      status: 'completed',
      createdAt: now()
    };
    this.db.orders.push(sample);
    this.addLedger('order', sample.total, 'Order #1 - ' + sample.items[0].name, sample.id);
    this.save();
  }

  addLedger(type, amount, note, refId) {
    this.db.ledger.push({ id: 'L' + Date.now().toString(36).toUpperCase(), type, amount, note, refId, createdAt: now() });
  }

  save(initial = false) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, DATA_FILE);
    this.scheduleGitCommit(initial);
  }

  scheduleGitCommit(initial) {
    this.gitQueue.push(initial ? 'Initial data seed' : 'Data update');
    if (this.gitTimer) return;
    this.gitTimer = setTimeout(() => {
      this.gitTimer = null;
      this.flushGitCommit();
    }, 8000);
  }

  flushGitCommit() {
    const messages = this.gitQueue.splice(0, this.gitQueue.length);
    if (messages.length === 0) return;
    const message = messages[0] + (messages.length > 1 ? ' (+' + (messages.length - 1) + ' more)' : '');
    const args = ['add', 'backend/data/db.json', '--'];
    execFile('git', args, { cwd: REPO_ROOT }, (err) => {
      if (err) return;
      execFile('git', ['commit', '-m', '[auto-save] ' + message], { cwd: REPO_ROOT }, (err) => {
        if (err) return;
        execFile('git', ['push', 'origin', 'HEAD'], { cwd: REPO_ROOT }, (err) => {
          if (err) console.error('auto-save push failed (will retry next change):', err.message);
          else console.log('[auto-save] pushed to GitHub:', message);
        });
      });
    });
  }

  get() {
    return this.db;
  }
}
