const express = require('express');
const SiteContent = require('../models/SiteContent');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// GET /api/content — fetch all content (public)
router.get('/', async (req, res) => {
  try {
    const contents = await SiteContent.find({});
    const result = {};
    contents.forEach((c) => {
      result[c.section] = c.data;
    });
    res.json({ success: true, content: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/content/:section — fetch specific section (public)
router.get('/:section', async (req, res) => {
  try {
    const content = await SiteContent.findOne({ section: req.params.section });
    if (!content) {
      return res.status(404).json({ success: false, error: 'Section not found.' });
    }
    res.json({ success: true, data: content.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/content/:section — update section (admin only)
router.put('/:section', requireAuth, async (req, res) => {
  try {
    const content = await SiteContent.findOneAndUpdate(
      { section: req.params.section },
      { data: req.body, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true, data: content.data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

