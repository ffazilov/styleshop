const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Config from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || 'YOUR_CHAT_ID_HERE';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/admin', express.static('admin'));

// Data storage (JSON files)
const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

function loadData(file, defaultVal) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {}
  return defaultVal;
}

function saveData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Initialize data files
if (!fs.existsSync(PRODUCTS_FILE)) {
  saveData(PRODUCTS_FILE, [
    {
      id: 1,
      name: "Klassik Ko'ylak",
      description: "Yumshoq paxta material, har kuni kiyish uchun ideal",
      price: 120000,
      category: "Ko'ylak",
      image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400",
      sizes: ["S", "M", "L", "XL"],
      inStock: true
    },
    {
      id: 2,
      name: "Slim Fit Shim",
      description: "Zamonaviy kesim, qulay va chiroyli",
      price: 180000,
      category: "Shim",
      image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
      sizes: ["28", "30", "32", "34"],
      inStock: true
    },
    {
      id: 3,
      name: "Sport Kurtka",
      description: "Yengil va issiq, sport va kundalik uchun",
      price: 350000,
      category: "Kurtka",
      image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400",
      sizes: ["S", "M", "L", "XL", "XXL"],
      inStock: true
    },
    {
      id: 4,
      name: "Yozgi Dress",
      description: "Nafis va qulay, bayramlarga mos",
      price: 220000,
      category: "Dress",
      image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400",
      sizes: ["XS", "S", "M", "L"],
      inStock: true
    }
  ]);
}

if (!fs.existsSync(ORDERS_FILE)) {
  saveData(ORDERS_FILE, []);
}

// ============ API ROUTES ============

// Get all products
app.get('/api/products', (req, res) => {
  const products = loadData(PRODUCTS_FILE, []);
  res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const products = loadData(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Topilmadi' });
  res.json(product);
});

// Place order
app.post('/api/orders', async (req, res) => {
  try {
    const { customer, items, total, phone, address, note } = req.body;

    if (!customer || !items || !items.length || !phone) {
      return res.status(400).json({ error: "Ma'lumotlar to'liq emas" });
    }

    const orders = loadData(ORDERS_FILE, []);
    const newOrder = {
      id: Date.now(),
      customer,
      phone,
      address: address || '',
      note: note || '',
      items,
      total,
      status: 'yangi',
      createdAt: new Date().toISOString()
    };

    orders.push(newOrder);
    saveData(ORDERS_FILE, orders);

    // Send Telegram notification
    await sendTelegramNotification(newOrder);

    res.json({ success: true, orderId: newOrder.id });
  } catch (err) {
    console.error('Order error:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// Get all orders (admin)
app.get('/api/admin/orders', (req, res) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Ruxsat yoq' });
  const orders = loadData(ORDERS_FILE, []);
  res.json(orders.reverse());
});

// Update order status (admin)
app.put('/api/admin/orders/:id', (req, res) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Ruxsat yoq' });

  const orders = loadData(ORDERS_FILE, []);
  const idx = orders.findIndex(o => o.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });

  orders[idx].status = req.body.status;
  saveData(ORDERS_FILE, orders);
  res.json({ success: true });
});

// Add product (admin)
app.post('/api/admin/products', (req, res) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Ruxsat yoq' });

  const products = loadData(PRODUCTS_FILE, []);
  const newProduct = {
    id: Date.now(),
    ...req.body,
    inStock: true
  };
  products.push(newProduct);
  saveData(PRODUCTS_FILE, products);
  res.json({ success: true, product: newProduct });
});

// Delete product (admin)
app.delete('/api/admin/products/:id', (req, res) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Ruxsat yoq' });

  let products = loadData(PRODUCTS_FILE, []);
  products = products.filter(p => p.id !== parseInt(req.params.id));
  saveData(PRODUCTS_FILE, products);
  res.json({ success: true });
});

// Update product (admin)
app.put('/api/admin/products/:id', (req, res) => {
  const auth = req.headers['x-admin-password'];
  if (auth !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Ruxsat yoq' });

  const products = loadData(PRODUCTS_FILE, []);
  const idx = products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Topilmadi' });

  products[idx] = { ...products[idx], ...req.body };
  saveData(PRODUCTS_FILE, products);
  res.json({ success: true });
});

// ============ TELEGRAM NOTIFICATION ============

async function sendTelegramNotification(order) {
  try {
    const itemsList = order.items.map(item =>
      `  â¢ ${item.name} (${item.size || '-'}) x${item.qty} â ${formatPrice(item.price * item.qty)}`
    ).join('\n');

    const message = `ð *YANGI ZAKAZ!*\n\n` +
      `ð¤ *Mijoz:* ${order.customer}\n` +
      `ð *Telefon:* ${order.phone}\n` +
      `ð *Manzil:* ${order.address || 'KoÊ»rsatilmagan'}\n\n` +
      `ð¦ *Mahsulotlar:*\n${itemsList}\n\n` +
      `ð° *Jami:* ${formatPrice(order.total)}\n` +
      `ð *Izoh:* ${order.note || 'YoÊ»q'}\n\n` +
      `ð *Vaqt:* ${new Date(order.createdAt).toLocaleString('uz-UZ')}\n` +
      `ð *Zakaz ID:* #${order.id}`;

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram error:', result);
    }
  } catch (err) {
    console.error('Telegram notification failed:', err);
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('uz-UZ').format(price) + " so'm";
}

app.listen(PORT, () => {
  console.log(`â StyleShop server running on port ${PORT}`);
});
