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
// Ne pas parser multipart/form-data (géré par multer)
// IMPORTANT: Express.json() ne doit PAS être appliqué aux requêtes multipart/form-data
// car multer doit gérer le body directement depuis le stream

// Middleware conditionnel pour JSON
app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    // Si c'est multipart/form-data, ne PAS parser, laisser multer gérer
    if (contentType.includes('multipart/form-data')) {
        return next();
    }
    // Sinon, parser comme JSON
    return express.json({ limit: '10mb' })(req, res, next);
});

// Middleware conditionnel pour URL-encoded
app.use((req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    // Si c'est multipart/form-data, ne PAS parser
    if (contentType.includes('multipart/form-data')) {
        return next();
    }
    // Sinon, parser comme URL-encoded
    return express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);
});

// Headers de sécurité
app.use((req, res, next) => {
    // Protection XSS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Protection contre le clickjacking
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net;");
    
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
    // Routes publiques pour le POS (pas besoin d'authentification)
    const publicPaths = [
        '/products',
        '/categories',
        '/sales',
        '/coupons/available',
        '/coupons/verify',
        '/tickets/purchase',
        '/tickets/config' // Route publique pour la configuration des tickets (accessible à tous)
    ];

    // Enlever le préfixe '/api' de la route pour la comparaison
    const path = req.path.replace('/api', '');

    // Vérifier si la route est publique
    const isPublic = publicPaths.some(route => path.startsWith(route));

    if (isPublic) {
        return next();
    }

    // Si ce n'est pas une route publique, vérifier l'authentification
    // Créer un middleware personnalisé qui ne redirige pas pour les API
    const apiAuthMiddleware = async (req, res, next) => {
        try {
            const token = req.cookies.token;
            if (!token) {
                return res.status(401).json({ message: 'Non authentifié' });
            }

            const jwt = require('jsonwebtoken');
            const User = require('./models/User');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            
            if (!user || !user.active) {
                res.clearCookie('token');
                return res.status(401).json({ message: 'Utilisateur invalide ou inactif' });
            }

            req.user = user;
            next();
        } catch (error) {
            res.clearCookie('token');
            return res.status(401).json({ message: 'Token invalide' });
        }
    };
    
    apiAuthMiddleware(req, res, () => {
        // Après authentification, vérifier si l'utilisateur est un vendeur de tickets
        if (req.user && req.user.role === 'ticket_seller') {
            // Les vendeurs de tickets peuvent accéder aux routes de tickets
            const allowedPaths = ['/tickets/purchase', '/tickets/config', '/tickets/seller'];
            const path = req.path.replace('/api', '');
            const isAllowed = allowedPaths.some(route => path.startsWith(route));
            if (!isAllowed) {
                return res.status(403).json({ message: 'Accès non autorisé pour les vendeurs de tickets' });
            }
        }
        next();
    });
};

// Routes
const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const { router: authRouter, authMiddleware } = require('./routes/auth');

// Routes d'authentification (publiques)
app.use('/auth', authRouter);

// Route de login (publique)
app.get('/login', async (req, res) => {
    if (req.cookies.token) {
        // Vérifier le rôle de l'utilisateur pour la redirection
        try {
            const jwt = require('jsonwebtoken');
            const User = require('./models/User');
            const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (user && user.active) {
                if (user.role === 'ticket_seller') {
                    return res.redirect('/tickets-seller');
                } else if (user.role === 'admin') {
                    return res.redirect('/admin');
                } else {
                    return res.redirect('/');
                }
            }
        } catch (error) {
            // Token invalide, continuer vers la page de login
        }
        const returnTo = req.query.returnTo || '/admin';
        return res.redirect(returnTo);
    }
    res.render('login', { returnTo: req.query.returnTo || '/admin' });
});

// Route publique pour l'achat de tickets (avant la protection du POS)
app.get('/tickets', (req, res) => {
    res.render('tickets', { user: req.user || null });
});

// Appliquer le middleware API AVANT les autres routes pour éviter les conflits
app.use('/api', publicApiMiddleware, apiRouter);

// Route pour les vendeurs de tickets (interface simplifiée) - AVANT la route '/'
const { ticketSellerMiddleware, posMiddleware } = require('./routes/auth');
app.get('/tickets-seller', authMiddleware, ticketSellerMiddleware, (req, res) => {
    res.render('tickets-seller', { user: req.user });
});

// Protéger la route POS avec authentification et vérifier le rôle
app.use('/', authMiddleware, posMiddleware, indexRouter);

// Protéger les routes admin avec authentification ET vérification de rôle admin
// Le middleware adminMiddleware dans admin.js vérifiera le rôle
app.use('/admin', authMiddleware, adminRouter);

// Gestion des erreurs 404
app.use((req, res, next) => {
    // Si c'est une route API, retourner JSON
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'Route API non trouvée' });
    }
    res.status(404).send('Page non trouvée');
});

// Gestion globale des erreurs (doit être après toutes les routes)
app.use((err, req, res, next) => {
    console.error('Erreur globale:', err);
    
    // Si c'est une route API, retourner JSON
    if (req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({ 
            message: err.message || 'Erreur serveur',
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
    
    // Sinon, retourner une page d'erreur HTML
    res.status(err.status || 500).send('Erreur serveur');
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