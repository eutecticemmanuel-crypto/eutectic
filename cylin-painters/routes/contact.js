const express = require('express');
const Contact = require('../models/Contact');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/contact
router.post('/contact', async (req, res) => {
  const { name, email, phone, service, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
  }

  try {
    const newContact = await Contact.create({
      name,
      email,
      phone: phone || '',
      service: service || '',
      message
    });

    res.status(201).json({ success: true, contact: newContact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/contacts (for admin review)
router.get('/contacts', requireAuth, async (req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    res.json({ success: true, contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/contacts/:id (admin only)
router.delete('/contacts/:id', requireAuth, async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Contact deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

