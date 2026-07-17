const Lead = require('../../models/Lead');
const { ok, fail } = require('../../utils/respond');
const asyncHandler = require('../../utils/asyncHandler');
const { notify } = require('../../services/notificationService');
const { logAction } = require('../../services/auditService');

const STATUSES = ['new', 'contacted', 'interested', 'test_drive', 'visited', 'negotiation', 'booked', 'sold', 'lost'];

exports.list = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const { status, search, product } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (product) filter.product = product;
  if (search) {
    const rx = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [{ customerName: rx }, { customerPhone: rx }, { customerEmail: rx }];
  }

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .populate({ path: 'product', select: 'name category price createdBy images', populate: { path: 'createdBy', select: 'name email' } })
      .populate('customer', 'name email phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Lead.countDocuments(filter),
  ]);

  ok(res, { items, total, page, pages: Math.ceil(total / limit) || 1 }, 'Leads');
});

exports.getOne = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id)
    .populate({ path: 'product', select: 'name category price createdBy images', populate: { path: 'createdBy', select: 'name email phone' } })
    .populate('customer', 'name email phone')
    .populate('saleId', 'salePrice soldDate status')
    .lean();
  if (!lead) return fail(res, 'Lead not found', 404);
  ok(res, lead, 'Lead');
});

exports.update = asyncHandler(async (req, res) => {
  const { status, note } = req.body || {};
  const lead = await Lead.findById(req.params.id);
  if (!lead) return fail(res, 'Lead not found', 404);

  if (status) {
    if (!STATUSES.includes(status)) return fail(res, 'Invalid status', 400);
    if (status !== lead.status) {
      lead.history.push({ status, at: new Date(), note: note || '' });
      lead.status = status;
      notify({
        audience: 'dealer',
        type: 'lead_status_changed',
        title: 'Lead Status Updated',
        body: `${lead.customerName}'s lead moved to "${status.replace(/_/g, ' ')}"`,
        entityType: 'lead',
        entityId: lead._id,
        createdBy: req.user._id,
      });
      if (lead.customer) {
        notify({
          target: lead.customer,
          type: 'lead_status_changed',
          title: 'Your Enquiry Was Updated',
          body: `Your enquiry status is now "${status.replace(/_/g, ' ')}"`,
          entityType: 'lead',
          entityId: lead._id,
        });
      }
    }
  }
  if (note && String(note).trim()) {
    lead.notes.push({ text: String(note).trim(), at: new Date(), by: req.user._id });
  }
  await lead.save();
  logAction({ action: 'lead_updated', entityType: 'lead', entityId: lead._id, entityLabel: lead.customerName, user: req.user });
  ok(res, lead, 'Lead updated');
});

exports.analytics = asyncHandler(async (req, res) => {
  const statusAgg = await Lead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const breakdown = statusAgg.reduce((acc, r) => { acc[r._id] = r.n; return acc; }, {});

  const totalLeads = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const convertedLeads = (breakdown.sold || 0) + (breakdown.booked || 0);
  const lostLeads = breakdown.lost || 0;
  const conversionRate = totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

  ok(res, { totalLeads, convertedLeads, lostLeads, conversionRate, statusBreakdown: breakdown }, 'Lead analytics');
});
