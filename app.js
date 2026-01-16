const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Connexion à MongoDB avec gestion d'erreur
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connexion à MongoDB réussie !');
})
.catch((err) => {
  console.error('Erreur de connexion à MongoDB :', err.message);
  process.exit(1);
});

// Gestion des erreurs MongoDB
mongoose.connection.on('error', (err) => {
  console.error('Erreur MongoDB :', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB déconnecté !');
});

// Configuration du middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Limiter la taille des requêtes pour prévenir les attaques
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Headers de sécurité
app.use((req, res, next) => {
    // Protection XSS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Protection contre le clickjacking
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self';");
    
    // Strict Transport Security (HTTPS uniquement en production)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
});

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 jour
  })
}));

// Ajouter cookie-parser middleware
app.use(cookieParser());

// Middleware pour les routes publiques de l'API
const publicApiMiddleware = (req, res, next) => {
    // Routes publiques pour le POS
    const publicPaths = [
        '/products',
        '/categories',
        '/sales',
        '/coupons/available',
        '/coupons/verify'
    ];

    console.log('Route demandée:', req.path); // Log pour déboguer

    // Enlever le préfixe '/api' de la route pour la comparaison
    const path = req.path.replace('/api', '');
    console.log('Route sans préfixe:', path); // Log pour déboguer

    // Vérifier si la route est publique
    const isPublic = publicPaths.some(route => path.startsWith(route));
    
    console.log('Est une route publique:', isPublic); // Log pour déboguer

    if (isPublic) {
        console.log('Accès autorisé à la route publique'); // Log pour déboguer
        return next();
    }

    console.log('Route protégée - vérification auth'); // Log pour déboguer
    // Si ce n'est pas une route publique, vérifier l'authentification
    authMiddleware(req, res, next);
};

// Routes
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const { router: authRouter, authMiddleware } = require('./routes/auth');

// Routes d'authentification (publiques)
app.use('/auth', authRouter);

// Route de login (publique)
app.get('/login', (req, res) => {
    if (req.cookies.token) {
        // Vérifier si l'utilisateur vient du POS ou de l'admin
        const returnTo = req.query.returnTo || '/admin';
        return res.redirect(returnTo);
    }
    res.render('login', { returnTo: req.query.returnTo || '/admin' });
});

// Protéger la route POS avec authentification
app.use('/', authMiddleware, indexRouter);

// Appliquer le middleware API avant la route admin
app.use('/api', publicApiMiddleware, apiRouter);

// Protéger les routes admin en dernier
app.use('/admin', authMiddleware, adminRouter);

// Gestion des erreurs 404
app.use((req, res, next) => {
    res.status(404).send('Page non trouvée');
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Quelque chose s\'est mal passé!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
}); 