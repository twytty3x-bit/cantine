const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  // Passer les informations de l'utilisateur à la vue
  res.render('index', { user: req.user || null });
});

module.exports = router; 