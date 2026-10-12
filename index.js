const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Employee, Category, Asset, AssetEvent } = require('../models');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
const required = (value) => typeof value === 'string' && value.trim().length > 0;
const formValue = (value) => (required(value) ? value.trim() : null);
const validPurchaseCost = (value) => required(value)
  && /^\d+(\.\d{1,2})?$/.test(value.trim())
  && Number(value) <= 9999999999.99;
const validDate = (value) => {
  if (!required(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
};
const findAssetOptions = {
  include: [
    { model: Category },
    { model: Employee, required: false }
  ]
};

router.get('/', asyncRoute(async (req, res) => {
  const [employeeCount, inStockCount, issuedCount, scrappedCount, recentEvents] = await Promise.all([
    Employee.count({ where: { active: true } }),
    Asset.count({ where: { status: 'in_stock' } }),
    Asset.count({ where: { status: 'issued' } }),
    Asset.count({ where: { status: 'scrapped' } }),
    AssetEvent.findAll({
      include: [
        { model: Asset, include: [Category] },
        { model: Employee, required: false }
      ],
      order: [['eventDate', 'DESC']],
      limit: 8
    })
  ]);
  res.render('dashboard', {
    title: 'Dashboard',
    employeeCount,
    inStockCount,
    issuedCount,
    scrappedCount,
    recentEvents
  });
}));

router.get('/employees', asyncRoute(async (req, res) => {
  const where = {};
  if (req.query.status === 'active') where.active = true;
  if (req.query.status === 'inactive') where.active = false;
  const search = formValue(req.query.search);
  if (search) {
    where[Op.or] = [
      { employeeCode: { [Op.iLike]: `%${search}%` } },
      { name: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { department: { [Op.iLike]: `%${search}%` } },
      { branch: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const employees = await Employee.findAll({ where, order: [['name', 'ASC']] });
  res.render('employees/index', {
    title: 'Employees',
    employees,
    search: req.query.search || '',
    status: req.query.status || ''
  });
}));

router.get('/employees/new', (req, res) => {
  res.render('employees/form', { title: 'Add employee', employee: {}, action: '/employees' });
});

router.post('/employees', asyncRoute(async (req, res) => {
  const { employeeCode, name, branch } = req.body;
  if (![employeeCode, name, branch].every(required)) {
    req.flash('error', 'Employee code, name, and branch are required.');
    return res.redirect('/employees/new');
  }
  await Employee.create({
    employeeCode: employeeCode.trim(),
    name: name.trim(),
    email: formValue(req.body.email),
    phone: formValue(req.body.phone),
    department: formValue(req.body.department),
    branch: branch.trim(),
    active: req.body.active === 'on'
  });
  req.flash('success', 'Employee added.');
  res.redirect('/employees');
}));

router.get('/employees/:id/edit', asyncRoute(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).render('not-found', { title: 'Employee not found' });
  res.render('employees/form', {
    title: 'Edit employee',
    employee,
    action: `/employees/${employee.id}/update`
  });
}));

router.post('/employees/:id/update', asyncRoute(async (req, res) => {
  const employee = await Employee.findByPk(req.params.id);
  if (!employee) return res.status(404).render('not-found', { title: 'Employee not found' });
  const { employeeCode, name, branch } = req.body;
  if (![employeeCode, name, branch].every(required)) {
    req.flash('error', 'Employee code, name, and branch are required.');
    return res.redirect(`/employees/${employee.id}/edit`);
  }
  await employee.update({
    employeeCode: employeeCode.trim(),
    name: name.trim(),
    email: formValue(req.body.email),
    phone: formValue(req.body.phone),
    department: formValue(req.body.department),
    branch: branch.trim(),
    active: req.body.active === 'on'
  });
  req.flash('success', 'Employee updated.');
  res.redirect('/employees');
}));

router.get('/categories', asyncRoute(async (req, res) => {
  const categories = await Category.findAll({
    include: [{ model: Asset, attributes: ['id'] }],
    order: [['name', 'ASC']]
  });
  res.render('categories/index', { title: 'Asset categories', categories });
}));

router.get('/categories/new', (req, res) => {
  res.render('categories/form', { title: 'Add category', category: {}, action: '/categories' });
});

router.post('/categories', asyncRoute(async (req, res) => {
  if (!required(req.body.name)) {
    req.flash('error', 'Category name is required.');
    return res.redirect('/categories/new');
  }
  await Category.create({ name: req.body.name.trim(), description: formValue(req.body.description) });
  req.flash('success', 'Category added.');
  res.redirect('/categories');
}));

router.get('/categories/:id/edit', asyncRoute(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) return res.status(404).render('not-found', { title: 'Category not found' });
  res.render('categories/form', {
    title: 'Edit category',
    category,
    action: `/categories/${category.id}/update`
  });
}));

router.post('/categories/:id/update', asyncRoute(async (req, res) => {
  const category = await Category.findByPk(req.params.id);
  if (!category) return res.status(404).render('not-found', { title: 'Category not found' });
  if (!required(req.body.name)) {
    req.flash('error', 'Category name is required.');
    return res.redirect(`/categories/${category.id}/edit`);
  }
  await category.update({ name: req.body.name.trim(), description: formValue(req.body.description) });
  req.flash('success', 'Category updated.');
  res.redirect('/categories');
}));

router.get('/assets', asyncRoute(async (req, res) => {
  const where = { status: { [Op.ne]: 'scrapped' } };
  if (['in_stock', 'issued'].includes(req.query.status)) where.status = req.query.status;
  if (req.query.categoryId) where.CategoryId = req.query.categoryId;
  const search = formValue(req.query.search);
  if (search) {
    where[Op.or] = [
      { assetTag: { [Op.iLike]: `%${search}%` } },
      { serialNumber: { [Op.iLike]: `%${search}%` } },
      { make: { [Op.iLike]: `%${search}%` } },
      { model: { [Op.iLike]: `%${search}%` } }
    ];
  }
  const [assets, categories] = await Promise.all([
    Asset.findAll({ where, ...findAssetOptions, order: [['assetTag', 'ASC']] }),
    Category.findAll({ order: [['name', 'ASC']] })
  ]);
  res.render('assets/index', {
    title: 'Assets',
    assets,
    categories,
    search: req.query.search || '',
    categoryId: req.query.categoryId || '',
    status: req.query.status || ''
  });
}));

router.get('/assets/new', asyncRoute(async (req, res) => {
  const categories = await Category.findAll({ order: [['name', 'ASC']] });
  res.render('assets/form', { title: 'Add asset', asset: {}, categories, action: '/assets' });
}));

router.post('/assets', asyncRoute(async (req, res) => {
  const { assetTag, serialNumber, make, model, purchaseDate, purchaseCost, branch, categoryId } = req.body;
  if (![assetTag, serialNumber, make, model, branch, categoryId].every(required)
    || !validDate(purchaseDate) || !validPurchaseCost(purchaseCost)) {
    req.flash('error', 'Complete all required asset fields and enter a valid non-negative purchase cost.');
    return res.redirect('/assets/new');
  }
  await sequelize.transaction(async (transaction) => {
    const asset = await Asset.create({
      assetTag: assetTag.trim(),
      serialNumber: serialNumber.trim(),
      make: make.trim(),
      model: model.trim(),
      purchaseDate,
      purchaseCost,
      branch: branch.trim(),
      CategoryId: categoryId,
      status: 'in_stock'
    }, { transaction });
    await AssetEvent.create({
      AssetId: asset.id,
      type: 'purchase',
      eventDate: new Date(`${purchaseDate}T00:00:00`),
      branch: branch.trim()
    }, { transaction });
  });
  req.flash('success', 'Asset added to stock.');
  res.redirect('/assets');
}));

router.get('/assets/:id/edit', asyncRoute(async (req, res) => {
  const [asset, categories] = await Promise.all([
    Asset.findByPk(req.params.id),
    Category.findAll({ order: [['name', 'ASC']] })
  ]);
  if (!asset || asset.status === 'scrapped') {
    return res.status(404).render('not-found', { title: 'Asset not found' });
  }
  res.render('assets/form', { title: 'Edit asset', asset, categories, action: `/assets/${asset.id}/update` });
}));

router.post('/assets/:id/update', asyncRoute(async (req, res) => {
  const asset = await Asset.findByPk(req.params.id);
  if (!asset || asset.status === 'scrapped') {
    return res.status(404).render('not-found', { title: 'Asset not found' });
  }
  const { assetTag, serialNumber, make, model, purchaseDate, purchaseCost, branch, categoryId } = req.body;
  if (![assetTag, serialNumber, make, model, branch, categoryId].every(required)
    || !validDate(purchaseDate) || !validPurchaseCost(purchaseCost)) {
    req.flash('error', 'Complete all required asset fields and enter a valid non-negative purchase cost.');
    return res.redirect(`/assets/${asset.id}/edit`);
  }
  await asset.update({
    assetTag: assetTag.trim(),
    serialNumber: serialNumber.trim(),
    make: make.trim(),
    model: model.trim(),
    purchaseDate,
    purchaseCost,
    branch: branch.trim(),
    CategoryId: categoryId
  });
  req.flash('success', 'Asset updated.');
  res.redirect('/assets');
}));

router.get('/stock', asyncRoute(async (req, res) => {
  const assets = await Asset.findAll({
    where: { status: 'in_stock' },
    include: [Category],
    order: [['branch', 'ASC'], ['assetTag', 'ASC']]
  });
  const totals = new Map();
  for (const asset of assets) {
    const current = totals.get(asset.branch) || { count: 0, valueCents: 0 };
    current.count += 1;
    current.valueCents += Math.round(Number(asset.purchaseCost) * 100);
    totals.set(asset.branch, current);
  }
  const branchTotals = Array.from(totals, ([branch, total]) => ({
    branch,
    count: total.count,
    value: total.valueCents / 100
  }));
  res.render('stock', {
    title: 'Stock by branch',
    assets,
    branchTotals,
    totalValue: assets.reduce((total, asset) => total + Math.round(Number(asset.purchaseCost) * 100), 0) / 100
  });
}));

router.get('/issues/new', asyncRoute(async (req, res) => {
  const [assets, employees] = await Promise.all([
    Asset.findAll({ where: { status: 'in_stock' }, include: [Category], order: [['assetTag', 'ASC']] }),
    Employee.findAll({ where: { active: true }, order: [['name', 'ASC']] })
  ]);
  res.render('issues/new', { title: 'Issue an asset', assets, employees });
}));

router.post('/issues', asyncRoute(async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    const asset = await Asset.findByPk(req.body.assetId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const employee = await Employee.findByPk(req.body.employeeId, { transaction });
    if (!asset || asset.status !== 'in_stock') throw new Error('That asset is no longer available in stock.');
    if (!employee || !employee.active) throw new Error('Select an active employee.');
    await asset.update({
      status: 'issued',
      EmployeeId: employee.id,
      branch: employee.branch
    }, { transaction });
    await AssetEvent.create({
      AssetId: asset.id,
      EmployeeId: employee.id,
      type: 'issue',
      branch: employee.branch
    }, { transaction });
  });
  req.flash('success', 'Asset issued successfully.');
  res.redirect('/assets');
}));

router.get('/returns', asyncRoute(async (req, res) => {
  const assets = await Asset.findAll({
    where: { status: 'issued' },
    ...findAssetOptions,
    order: [['assetTag', 'ASC']]
  });
  res.render('returns/index', { title: 'Return an asset', assets });
}));

router.post('/returns/:id', asyncRoute(async (req, res) => {
  const reason = formValue(req.body.reason);
  if (!reason) {
    req.flash('error', 'A reason for return is required.');
    return res.redirect('/returns');
  }
  await sequelize.transaction(async (transaction) => {
    const asset = await Asset.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!asset || asset.status !== 'issued') throw new Error('That asset is not currently issued.');
    const employeeId = asset.EmployeeId;
    await AssetEvent.create({
      AssetId: asset.id,
      EmployeeId: employeeId,
      type: 'return',
      reason,
      branch: asset.branch
    }, { transaction });
    await asset.update({ status: 'in_stock', EmployeeId: null }, { transaction });
  });
  req.flash('success', 'Asset returned to stock.');
  res.redirect('/returns');
}));

router.get('/scrap', asyncRoute(async (req, res) => {
  const assets = await Asset.findAll({
    where: { status: 'in_stock' },
    include: [Category],
    order: [['assetTag', 'ASC']]
  });
  res.render('scrap/index', { title: 'Scrap an asset', assets });
}));

router.post('/scrap/:id', asyncRoute(async (req, res) => {
  const reason = formValue(req.body.reason);
  if (!reason) {
    req.flash('error', 'A reason for scrapping the asset is required.');
    return res.redirect('/scrap');
  }
  await sequelize.transaction(async (transaction) => {
    const asset = await Asset.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!asset || asset.status !== 'in_stock') {
      throw new Error('Only assets currently in stock can be scrapped. Return an issued asset first.');
    }
    await AssetEvent.create({
      AssetId: asset.id,
      type: 'scrap',
      reason,
      branch: asset.branch
    }, { transaction });
    await asset.update({ status: 'scrapped' }, { transaction });
  });
  req.flash('success', 'Asset scrapped and removed from operational pages.');
  res.redirect('/scrap');
}));

router.get('/reports/scrapped', asyncRoute(async (req, res) => {
  const assets = await Asset.findAll({
    where: { status: 'scrapped' },
    ...findAssetOptions,
    order: [['updatedAt', 'DESC']]
  });
  res.render('reports/scrapped', { title: 'Scrapped assets report', assets });
}));

router.get('/assets/:id/history', asyncRoute(async (req, res) => {
  const asset = await Asset.findByPk(req.params.id, {
    include: [Category, { model: Employee, required: false }]
  });
  if (!asset) return res.status(404).render('not-found', { title: 'Asset not found' });
  const events = await AssetEvent.findAll({
    where: { AssetId: asset.id },
    include: [{ model: Employee, required: false }],
    order: [['eventDate', 'DESC'], ['createdAt', 'DESC']]
  });
  res.render('assets/history', { title: `History: ${asset.assetTag}`, asset, events });
}));

module.exports = router;
