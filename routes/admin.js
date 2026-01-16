const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('./auth');

// Appliquer le middleware admin à toutes les routes
router.use(adminMiddleware);

// Route principale de l'admin
router.get('/', (req, res) => {
    res.render('admin/dashboard', { user: req.user });
});

module.exports = router; 