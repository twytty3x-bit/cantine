const express = require('express');
const router = express.Router();

// Middleware pour vérifier l'authentification
const checkAuth = (req, res, next) => {
    // À implémenter : vérification de l'authentification
    // Pour l'instant, on laisse passer
    next();
};

// Route principale de l'admin
router.get('/', checkAuth, (req, res) => {
    res.render('admin/dashboard');
});

module.exports = router; 