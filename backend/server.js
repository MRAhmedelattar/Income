require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma Client
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // زيادة حد حجم الطلب لدعم الشعارات
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Routes

// Health check endpoint - يجب أن يكون أول endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Config routes
app.get('/api/config', async (req, res) => {
  try {
    const config = await prisma.config.findFirst();
    res.json(config || {});
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { universityName, universityLogo, facultyName, facultyLogo } = req.body;
    const config = await prisma.config.upsert({
      where: { id: 1 },
      update: { universityName, universityLogo, facultyName, facultyLogo },
      create: { id: 1, universityName, universityLogo, facultyName, facultyLogo },
    });
    res.json(config);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Funds routes
app.get('/api/funds', async (req, res) => {
  try {
    const funds = await prisma.fund.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    res.json(funds);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/funds', async (req, res) => {
  try {
    const { id, name, orderIndex = 0 } = req.body;
    const fund = await prisma.fund.create({
      data: { id, name, orderIndex },
    });
    res.json(fund);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/funds/:id', async (req, res) => {
  try {
    const { name, orderIndex } = req.body;
    const fund = await prisma.fund.update({
      where: { id: req.params.id },
      data: { name, orderIndex },
    });
    res.json(fund);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/funds/:id', async (req, res) => {
  try {
    await prisma.fund.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Fund deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Items routes
app.get('/api/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { orderIndex: 'asc' },
      include: { fund: true, budgetItem: true },
    });
    res.json(items);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { id, name, defaultValue, isEditable, type, fundId, budgetItemId, orderIndex = 0 } = req.body;
    const item = await prisma.item.create({
      data: { id, name, defaultValue, isEditable, type, fundId, budgetItemId, orderIndex },
    });
    res.json(item);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { name, defaultValue, isEditable, type, fundId, budgetItemId, orderIndex } = req.body;
    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: { name, defaultValue, isEditable, type, fundId, budgetItemId, orderIndex },
    });
    res.json(item);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    await prisma.item.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Revenues routes
app.get('/api/revenues', async (req, res) => {
  try {
    const revenues = await prisma.revenue.findMany({
      include: { items: true },
      orderBy: { orderIndex: 'asc' },
    });

    // Transform to match old format
    const formattedRevenues = revenues.map(revenue => {
      const itemValues = {};
      revenue.items.forEach(item => {
        // تأكد من تحويل الأرقام بشكل صريح
        itemValues[item.itemId] = parseFloat(item.amount) || 0;
      });
      return {
        id: revenue.id,
        title: revenue.title,
        type: revenue.type,
        date: revenue.date,
        orderIndex: revenue.orderIndex,
        itemValues,
      };
    });

    res.json(formattedRevenues);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/revenues', async (req, res) => {
  try {
    const { id, title, type, date, itemValues, orderIndex = 0 } = req.body;

    // تطبيع وتحويل الأرقام قبل الحفظ
    const normalizedItemValues = {};
    if (itemValues) {
      Object.entries(itemValues).forEach(([itemId, amount]) => {
        normalizedItemValues[itemId] = parseFloat(amount) || 0;
      });
    }

    const revenue = await prisma.revenue.create({
      data: {
        id,
        title,
        type,
        date,
        orderIndex,
        items: Object.keys(normalizedItemValues).length > 0 ? {
          create: Object.entries(normalizedItemValues).map(([itemId, amount]) => ({
            itemId,
            amount: parseFloat(amount), // تأكد من التحويل
          })),
        } : undefined,
      },
      include: { items: true },
    });

    // Format response مع تحويل الأرقام
    const formatted = {
      id: revenue.id,
      title: revenue.title,
      type: revenue.type,
      date: revenue.date,
      orderIndex: revenue.orderIndex,
      itemValues: normalizedItemValues,
    };

    res.json(formatted);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/revenues/:id', async (req, res) => {
  try {
    const { title, type, date, itemValues, orderIndex } = req.body;

    // تطبيع وتحويل الأرقام قبل الحفظ
    const normalizedItemValues = {};
    if (itemValues) {
      Object.entries(itemValues).forEach(([itemId, amount]) => {
        normalizedItemValues[itemId] = parseFloat(amount) || 0;
      });
    }

    // حذف البيانات القديمة
    await prisma.revenueItem.deleteMany({
      where: { revenueId: req.params.id },
    });

    const revenue = await prisma.revenue.update({
      where: { id: req.params.id },
      data: {
        title,
        type,
        date,
        orderIndex,
        items: Object.keys(normalizedItemValues).length > 0 ? {
          create: Object.entries(normalizedItemValues).map(([itemId, amount]) => ({
            itemId,
            amount: parseFloat(amount), // تأكد من التحويل
          })),
        } : undefined,
      },
      include: { items: true },
    });

    // Format response مع تحويل الأرقام
    const formatted = {
      id: revenue.id,
      title: revenue.title,
      type: revenue.type,
      date: revenue.date,
      orderIndex: revenue.orderIndex,
      itemValues: normalizedItemValues,
    };

    res.json(formatted);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/revenues/:id', async (req, res) => {
  try {
    await prisma.revenue.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Revenue deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Collections routes
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await prisma.collection.findMany({
      include: { distribution: true, revenue: true },
      orderBy: { registrationDate: 'desc' },
    });

    // Transform to match old format
    const formattedCollections = collections.map(collection => {
      const distribution = collection.distribution.map(d => ({
        itemId: d.itemId,
        amount: d.amount,
      }));
      return {
        id: collection.id,
        registrationDate: collection.registrationDate,
        paymentDate: collection.paymentDate,
        receiptNumber: collection.receiptNumber,
        name: collection.name,
        total: collection.total,
        selectedRevenueId: collection.selectedRevenueId,
        distribution,
        revenue: collection.revenue,
      };
    });

    res.json(formattedCollections);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/collections', async (req, res) => {
  try {
    const { id, registrationDate, paymentDate, receiptNumber, name, total, selectedRevenueId, distribution } = req.body;

    // HDD-Safe: Structure Validation قبل Transaction
    if (!distribution || !Array.isArray(distribution) || distribution.length === 0) {
      return res.status(400).json({ error: 'هيكل التوزيع غير مكتمل' });
    }

    // Data Integrity: Number parsing
    const normalizedTotal = Number(total);
    const normalizedDistribution = distribution.map(item => ({
      itemId: item.itemId,
      amount: Number(item.amount),
    })).filter(item => item.itemId && !isNaN(item.amount));

    if (normalizedDistribution.length === 0) {
      return res.status(400).json({ error: 'هيكل التوزيع غير مكتمل' });
    }

    // Transaction: All or Nothing لـ HDD reliability
    const collection = await prisma.$transaction(async (tx) => {
      return tx.collection.create({
        data: {
          id,
          registrationDate,
          paymentDate,
          receiptNumber,
          name,
          total: normalizedTotal,
          selectedRevenueId,
          distribution: {
            createMany: {
              data: normalizedDistribution,
            },
          },
        },
        include: { distribution: true, revenue: true },
      });
    });

    res.json({
      id: collection.id,
      registrationDate: collection.registrationDate,
      paymentDate: collection.paymentDate,
      receiptNumber: collection.receiptNumber,
      name: collection.name,
      total: normalizedTotal,
      distribution: normalizedDistribution,
      revenue: collection.revenue,
    });
  } catch (error) {
    console.error('POST /api/collections error:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'رقم إيصال مكرر' });
    } else if (error.code === 'P2025') {
      res.status(404).json({ error: 'إيراد غير موجود' });
    } else if (error.message.includes('lock') || error.message.includes('timeout')) {
      res.status(503).json({ error: 'فشل قفل قاعدة البيانات أو انتهت مهلة I/O (HDD بطيء)' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.put('/api/collections/:id', async (req, res) => {
  try {
    const { registrationDate, paymentDate, receiptNumber, name, total, selectedRevenueId, distribution } = req.body;

    // HDD-Safe: Structure Validation
    if (!distribution || !Array.isArray(distribution) || distribution.length === 0) {
      return res.status(400).json({ error: 'هيكل التوزيع غير مكتمل' });
    }

    // Data Integrity: Number parsing + filtering
    const normalizedTotal = Number(total);
    const normalizedDistribution = distribution.map(item => ({
      itemId: item.itemId,
      amount: Number(item.amount),
    })).filter(item => item.itemId && !isNaN(item.amount));

    if (normalizedDistribution.length === 0) {
      return res.status(400).json({ error: 'هيكل التوزيع غير مكتمل' });
    }

    // Transaction: All or Nothing
    const collection = await prisma.$transaction(async (tx) => {
      // Clear old distribution
      await tx.collectionDistribution.deleteMany({
        where: { collectionId: req.params.id },
      });

      // Update collection + new distribution
      return tx.collection.update({
        where: { id: req.params.id },
        data: {
          registrationDate,
          paymentDate,
          receiptNumber,
          name,
          total: normalizedTotal,
          selectedRevenueId,
          distribution: {
            createMany: {
              data: normalizedDistribution,
            },
          },
        },
        include: { distribution: true },
      });
    });

    res.json({
      id: collection.id,
      registrationDate: collection.registrationDate,
      paymentDate: collection.paymentDate,
      receiptNumber: collection.receiptNumber,
      name: collection.name,
      total: normalizedTotal,
      distribution: normalizedDistribution,
    });
  } catch (error) {
    console.error('PUT /api/collections error:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'تحصيل غير موجود' });
    } else if (error.message.includes('lock') || error.message.includes('timeout')) {
      res.status(503).json({ error: 'فشل قفل قاعدة البيانات أو انتهت مهلة I/O (HDD بطيء)' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  try {
    await prisma.collection.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // إزالة كلمة المرور من الاستجابة
    const { password: _, ...userWithoutPassword } = user;
    // الصلاحيات مخزنة كـ JSON string، لذا نحللها هنا
    try {
      userWithoutPassword.permissions = JSON.parse(user.permissions || '{}');
    } catch (e) {
      console.error('خطأ في تحليل الصلاحيات أثناء تسجيل الدخول:', e);
      userWithoutPassword.permissions = {};
    }

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Logout route (يمكن أن يكون بسيطاً لأن التوكن يُدار في الفرونت)
app.post('/api/logout', async (req, res) => {
  res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

// Users routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    const formattedUsers = users.map(user => {
      let permissions = {};
      try {
        permissions = JSON.parse(user.permissions || '{}');
      } catch (e) {
        console.error('خطأ في تحليل الصلاحيات للمستخدم:', user.id, e);
      }
      return {
        ...user,
        permissions,
      };
    });
    res.json(formattedUsers);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body;
    const user = await prisma.user.create({
      data: {
        id: Date.now().toString(),
        username,
        password,
        role,
        permissions: JSON.stringify(permissions || {}),
        createdAt: new Date().toISOString(),
      },
    });
    let parsedPermissions = {};
    try {
      parsedPermissions = JSON.parse(user.permissions || '{}');
    } catch (e) {
      console.error('خطأ في تحليل الصلاحيات بعد الإنشاء:', e);
    }
    const formattedUser = {
      ...user,
      permissions: parsedPermissions,
    };
    res.json(formattedUser);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body;
    const updateData = { username, role, permissions: JSON.stringify(permissions || {}) };
    if (password) {
      updateData.password = password;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
    });
    let parsedPermissions = {};
    try {
      parsedPermissions = JSON.parse(user.permissions || '{}');
    } catch (e) {
      console.error('خطأ في تحليل الصلاحيات بعد التحديث:', e);
    }
    const formattedUser = {
      ...user,
      permissions: parsedPermissions,
    };
    res.json(formattedUser);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Deductions routes
app.get('/api/deductions', async (req, res) => {
  try {
    const deductions = await prisma.deduction.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    res.json(deductions);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/deductions', async (req, res) => {
  try {
    const { id, name, percentage, orderIndex = 0 } = req.body;
    const deduction = await prisma.deduction.create({
      data: { id, name, percentage, orderIndex },
    });
    res.json(deduction);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/deductions/:id', async (req, res) => {
  try {
    const { name, percentage, orderIndex } = req.body;
    const deduction = await prisma.deduction.update({
      where: { id: req.params.id },
      data: { name, percentage, orderIndex },
    });
    res.json(deduction);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/deductions/:id', async (req, res) => {
  try {
    await prisma.deduction.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Deduction deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Signatures routes
app.get('/api/signatures', async (req, res) => {
  try {
    const signatures = await prisma.signature.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    res.json(signatures);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/signatures', async (req, res) => {
  try {
    const { id, title, name, orderIndex = 0 } = req.body;
    const signature = await prisma.signature.create({
      data: { id, title, name, orderIndex },
    });
    res.json(signature);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/signatures/:id', async (req, res) => {
  try {
    const { title, name, orderIndex } = req.body;
    const signature = await prisma.signature.update({
      where: { id: req.params.id },
      data: { title, name, orderIndex },
    });
    res.json(signature);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/signatures/:id', async (req, res) => {
  try {
    await prisma.signature.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Signature deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Budget Items routes
app.get('/api/budget-items', async (req, res) => {
  try {
    const budgetItems = await prisma.budgetItem.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    res.json(budgetItems);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/budget-items', async (req, res) => {
  try {
    const { id, name, orderIndex = 0 } = req.body;
    const budgetItem = await prisma.budgetItem.create({
      data: { id, name, orderIndex },
    });
    res.json(budgetItem);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/budget-items/:id', async (req, res) => {
  try {
    const { name, orderIndex } = req.body;
    const budgetItem = await prisma.budgetItem.update({
      where: { id: req.params.id },
      data: { name, orderIndex },
    });
    res.json(budgetItem);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/budget-items/:id', async (req, res) => {
  try {
    await prisma.budgetItem.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Budget item deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

// Budget Deductions routes
app.get('/api/budget-deductions', async (req, res) => {
  try {
    const budgetDeductions = await prisma.budgetDeduction.findMany({
      orderBy: { orderIndex: 'asc' },
    });
    res.json(budgetDeductions);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/budget-deductions', async (req, res) => {
  try {
    const { id, name, percentage, orderIndex = 0 } = req.body;
    const budgetDeduction = await prisma.budgetDeduction.create({
      data: { id, name, percentage, orderIndex },
    });
    res.json(budgetDeduction);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/budget-deductions/:id', async (req, res) => {
  try {
    const { name, percentage, orderIndex } = req.body;
    const budgetDeduction = await prisma.budgetDeduction.update({
      where: { id: req.params.id },
      data: { name, percentage, orderIndex },
    });
    res.json(budgetDeduction);
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/budget-deductions/:id', async (req, res) => {
  try {
    await prisma.budgetDeduction.delete({
      where: { id: req.params.id },
    });
    res.json({ message: 'Budget deduction deleted successfully' });
  } catch (error) {
    console.error('Detailed error: ', error); // prints stack trace too
    res.status(500).json({ error: error.message });
  }
});



// Start server with Prisma connection check
async function initServer() {
  try {
    // Before connecting, ensure schema is applied and seed run (safe to run every startup)
    try {
      const { spawnSync } = require('child_process');
      const path = require('path');
      const prismaBin = path.join(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');

      // Run migrations (deploy) to create/update DB schema
      const migrateCmd = spawnSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
        cwd: __dirname,
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL,
          ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || '1'
        },
        encoding: 'utf8'
      });
      if (migrateCmd.status !== 0) {
        console.error('Prisma migrate deploy failed:', migrateCmd.stdout, migrateCmd.stderr);
      } else {
        console.log('Prisma migrations applied (deploy)');
      }

      // Run seeding script only if explicitly requested
      if (process.env.RUN_SEED === 'true') {
        const seedCmd = spawnSync(process.execPath, [path.join(__dirname, 'prisma', 'seed.js')], {
          cwd: __dirname,
          env: {
            ...process.env,
            DATABASE_URL: process.env.DATABASE_URL,
            ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || '1'
          },
          encoding: 'utf8'
        });
        if (seedCmd.status !== 0) {
          // Seeding may fail if already seeded, or due to errors; print stderr
          console.error('Prisma seed failed (or reported error):', seedCmd.stdout, seedCmd.stderr);
        } else {
          console.log('Prisma seeding completed');
        }
      } else {
        console.log('Seeding skipped (RUN_SEED not set)');
      }
    } catch (err) {
      console.error('Migration/seed runner failed:', err);
    }

    await prisma.$connect();
    console.log('Prisma connected to database successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

initServer().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Database connection closed.');
  process.exit(0);
});
