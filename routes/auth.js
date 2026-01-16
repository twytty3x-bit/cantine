const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware d'authentification
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            // Si c'est une requête API, retourner JSON au lieu de rediriger
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ message: 'Non authentifié' });
            }
            // Préserver l'URL de destination pour la redirection après login
            const returnTo = req.originalUrl === '/' ? '/' : req.originalUrl;
            return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || !user.active) {
            res.clearCookie('token');
            // Si c'est une requête API, retourner JSON au lieu de rediriger
            if (req.path.startsWith('/api/')) {
                return res.status(401).json({ message: 'Utilisateur invalide ou inactif' });
            }
            const returnTo = req.originalUrl === '/' ? '/' : req.originalUrl;
            return res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        }

        req.user = user;
        next();
    } catch (error) {
        res.clearCookie('token');
        // Si c'est une requête API, retourner JSON au lieu de rediriger
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ message: 'Token invalide' });
        }
        const returnTo = req.originalUrl === '/' ? '/' : req.originalUrl;
        res.redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
};

// Route de login avec protection contre les attaques par force brute
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const clientIp = req.ip || req.connection.remoteAddress;
        
        // Vérifier le rate limiting
        const attempts = loginAttempts.get(clientIp) || { count: 0, resetTime: Date.now() };
        
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            if (Date.now() < attempts.resetTime) {
                const remainingTime = Math.ceil((attempts.resetTime - Date.now()) / 1000 / 60);
                return res.status(429).json({ 
                    message: `Trop de tentatives. Réessayez dans ${remainingTime} minute(s).` 
                });
            } else {
                // Réinitialiser après la période de verrouillage
                loginAttempts.delete(clientIp);
            }
        }
        
        // Validation des entrées
        if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
            attempts.count++;
            attempts.resetTime = Date.now() + LOCKOUT_TIME;
            loginAttempts.set(clientIp, attempts);
            return res.status(400).json({ message: 'Identifiants invalides' });
        }
        
        // Limiter la longueur des entrées
        if (username.length > 50 || password.length > 100) {
            return res.status(400).json({ message: 'Identifiants invalides' });
        }
        
        const user = await User.findOne({ username });
        
        if (!user) {
            attempts.count++;
            attempts.resetTime = Date.now() + LOCKOUT_TIME;
            loginAttempts.set(clientIp, attempts);
            // Délai pour éviter l'énumération d'utilisateurs
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword || !user.active) {
            attempts.count++;
            attempts.resetTime = Date.now() + LOCKOUT_TIME;
            loginAttempts.set(clientIp, attempts);
            // Délai pour éviter l'énumération d'utilisateurs
            await new Promise(resolve => setTimeout(resolve, 1000));
            return res.status(401).json({ message: 'Identifiants invalides' });
        }

        // Réinitialiser les tentatives en cas de succès
        loginAttempts.delete(clientIp);

        // Créer le token JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Mettre à jour la dernière connexion
        user.lastLogin = new Date();
        await user.save();

        // Définir le cookie sécurisé
        // Déterminer la redirection selon le rôle
        let defaultReturnTo = '/admin';
        if (user.role === 'ticket_seller') {
            defaultReturnTo = '/tickets-seller';
        } else if (user.role === 'user') {
            defaultReturnTo = '/';
        }
        
        const returnTo = req.query.returnTo || req.body.returnTo || defaultReturnTo;
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 heures
        });

        res.json({ success: true, returnTo });
    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ message: 'Erreur lors de la connexion' });
    }
});

// Route de déconnexion
router.get('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    
    // Si c'est une requête AJAX, retourner JSON
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.accepts('json')) {
        return res.json({ success: true, message: 'Déconnexion réussie' });
    }
    // Sinon, rediriger
    res.redirect('/login');
});

// Routes protégées pour la gestion des utilisateurs (admin seulement)
router.use('/users', authMiddleware, async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accès non autorisé' });
    }
    next();
});

router.post('/users', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const user = new User({ username, password, role });
        await user.save();
        res.status(201).json({ message: 'Utilisateur créé avec succès' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.put('/users/:id/password', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        user.password = req.body.password;
        await user.save();
        res.json({ message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Middleware pour vérifier que l'utilisateur est admin
const adminMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).redirect('/login?returnTo=' + encodeURIComponent(req.originalUrl));
    }
    
    if (req.user.role !== 'admin') {
        return res.status(403).send('Accès refusé. Seuls les administrateurs peuvent accéder à cette page.');
    }
    
    next();
};

// Middleware pour vérifier que l'utilisateur peut accéder au POS (admin ou user, mais pas ticket_seller)
const posMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).redirect('/login?returnTo=' + encodeURIComponent(req.originalUrl));
    }
    
    if (req.user.role === 'ticket_seller') {
        // Les vendeurs de tickets sont redirigés vers leur interface dédiée
        return res.redirect('/tickets-seller');
    }
    
    next();
};

// Middleware pour vérifier que l'utilisateur est vendeur de tickets
const ticketSellerMiddleware = (req, res, next) => {
    if (!req.user) {
        return res.status(401).redirect('/login?returnTo=' + encodeURIComponent(req.originalUrl));
    }
    
    if (req.user.role !== 'ticket_seller') {
        return res.status(403).send('Accès refusé. Cette page est réservée aux vendeurs de tickets.');
    }
    
    next();
};

module.exports = { router, authMiddleware, adminMiddleware, posMiddleware, ticketSellerMiddleware }; 