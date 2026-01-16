const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const { authMiddleware } = require('./auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Configuration de multer pour le stockage des images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/products/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Seules les images sont autorisées!'));
    }
});

// Récupérer tous les produits
router.get('/products', async (req, res) => {
    try {
        console.log('Récupération des produits...'); // Log pour déboguer
        const products = await Product.find().lean();
        
        // Trier les prix par quantité pour chaque produit
        products.forEach(product => {
            if (product.quantityPrices) {
                product.quantityPrices.sort((a, b) => b.quantity - a.quantity);
            }
        });
        
        console.log('Nombre de produits trouvés:', products.length); // Log pour déboguer
        res.json(products);
    } catch (error) {
        console.error('Erreur lors de la récupération des produits:', error);
        res.status(500).json({ message: error.message });
    }
});

// Récupérer un produit spécifique
router.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Produit non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Rechercher des produits
router.get('/products/search', async (req, res) => {
    try {
        const query = req.query.q;
        const products = await Product.find({
            name: { $regex: query, $options: 'i' }
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Modifier la route POST pour les produits
router.post('/products', upload.single('image'), async (req, res) => {
    try {
        const productData = {
            name: req.body.name,
            category: req.body.category,
            price: parseFloat(req.body.price),
            costPrice: parseFloat(req.body.costPrice),
            stock: parseInt(req.body.stock),
            quantityPrices: JSON.parse(req.body.quantityPrices || '[]')
        };

        if (req.file) {
            productData.image = '/uploads/products/' + req.file.filename;
        }

        // Validation des prix par quantité
        if (productData.quantityPrices.length > 0) {
            const quantities = productData.quantityPrices.map(qp => qp.quantity);
            if (new Set(quantities).size !== quantities.length) {
                throw new Error('Les quantités doivent être uniques');
            }
        }

        const product = new Product(productData);
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        console.error('Erreur lors de l\'ajout du produit:', error);
        res.status(400).json({ 
            message: 'Erreur lors de l\'ajout du produit',
            error: error.message 
        });
    }
});

// Mettre à jour un produit
router.put('/products/:id', upload.single('image'), async (req, res) => {
    try {
        const productData = {
            name: req.body.name,
            category: req.body.category,
            price: parseFloat(req.body.price),
            costPrice: parseFloat(req.body.costPrice),
            stock: parseInt(req.body.stock),
            quantityPrices: JSON.parse(req.body.quantityPrices || '[]')
        };

        if (req.file) {
            productData.image = '/uploads/products/' + req.file.filename;
        }

        // Validation des prix par quantité
        if (productData.quantityPrices.length > 0) {
            const quantities = productData.quantityPrices.map(qp => qp.quantity);
            if (new Set(quantities).size !== quantities.length) {
                throw new Error('Les quantités doivent être uniques');
            }
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            productData,
            { new: true }
        );
        res.json(product);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du produit:', error);
        res.status(500).json({ message: error.message });
    }
});

// Supprimer un produit
router.delete('/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Produit supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Déplacer la route 'available' avant la route avec paramètre
router.get('/coupons/available', async (req, res) => {
    try {
        const now = new Date();
        const coupons = await Coupon.find({
            active: true,
            startDate: { $lte: now },
            endDate: { $gte: now },
            $or: [
                { usageLimit: null },
                { $expr: { $lt: ['$usageCount', '$usageLimit'] } }
            ]
        });
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Vérifier un coupon
router.get('/coupons/verify/:code', async (req, res) => {
    try {
        const coupon = await Coupon.findOne({ 
            code: req.params.code.toUpperCase(),
            active: true,
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(404).json({ message: 'Coupon invalide' });
        }

        if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
            return res.status(400).json({ message: 'Coupon épuisé' });
        }

        res.json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Modifier la route de création de vente
router.post('/sales', async (req, res) => {
    try {
        console.log('Données reçues:', JSON.stringify(req.body, null, 2));

        // Valider les données reçues
        if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ message: 'Les items sont requis' });
        }

        if (req.body.amountReceived === null || req.body.amountReceived === undefined) {
            return res.status(400).json({ message: 'Le montant reçu est requis' });
        }

        // Vérifier les items
        const validItems = req.body.items.map(item => ({
            product: item.product,
            quantity: item.quantity || 1,
            price: item.price || 0,
            cost: item.cost || 0,
            discount: item.discount || 0,
            finalPrice: item.finalPrice || (item.price - (item.discount / item.quantity)) || 0
        }));

        const sale = new Sale({
            items: validItems,
            total: req.body.total,
            originalTotal: req.body.originalTotal,
            discount: req.body.discount || 0,
            coupon: req.body.coupon || null,
            profit: req.body.profit,
            paymentMethod: req.body.paymentMethod || 'cash',
            amountReceived: req.body.amountReceived
        });

        console.log('Sale object avant sauvegarde:', sale);
        
        // Si un coupon est utilisé, mettre à jour son compteur
        if (sale.coupon) {
            await Coupon.findByIdAndUpdate(
                sale.coupon,
                { $inc: { usageCount: 1 } }
            );
        }

        const savedSale = await sale.save();
        console.log('Vente sauvegardée avec succès:', savedSale);
        
        // Mettre à jour les stocks
        for (const item of sale.items) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: -item.quantity } }
            );
        }
        
        res.status(201).json(savedSale);
    } catch (error) {
        console.error('Erreur détaillée lors de la création de la vente:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            message: 'Erreur lors de la création de la vente',
            error: error.message,
            stack: error.stack,
            details: error
        });
    }
});

// Réorganiser les routes des ventes et des statistiques
// 1. Route pour les statistiques spécifiques
router.get('/stats/coupons', async (req, res) => {
    try {
        const { start, end } = req.query;
        const dateQuery = {};
        if (start && end) {
            dateQuery.date = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }

        // Récupérer les ventes avec coupons
        const salesWithCoupons = await Sale.find({
            ...dateQuery,
            coupon: { $exists: true, $ne: null }
        })
        .populate('coupon')
        .populate('items.product')
        .lean();

        // Statistiques des coupons
        const couponStats = [];
        const couponMap = new Map();

        // Statistiques des produits vendus avec coupons
        const productMap = new Map();

        for (const sale of salesWithCoupons) {
            if (!sale.coupon) continue;

            // Stats des coupons
            if (!couponMap.has(sale.coupon._id.toString())) {
                couponMap.set(sale.coupon._id.toString(), {
                    couponInfo: sale.coupon,
                    usageCount: 0,
                    totalDiscount: 0
                });
            }
            const couponStat = couponMap.get(sale.coupon._id.toString());
            couponStat.usageCount++;
            couponStat.totalDiscount += sale.discount || 0;

            // Stats des produits
            const itemCount = sale.items.length;
            const discountPerItem = sale.discount / itemCount;

            for (const item of sale.items) {
                if (!item.product) continue;

                const productId = item.product._id.toString();
                if (!productMap.has(productId)) {
                    productMap.set(productId, {
                        productName: item.product.name,
                        totalQuantity: 0,
                        couponCount: 0,
                        totalDiscount: 0,
                        totalSales: 0
                    });
                }

                const productStat = productMap.get(productId);
                productStat.totalQuantity += item.quantity;
                productStat.couponCount++;
                productStat.totalDiscount += discountPerItem * item.quantity;
                productStat.totalSales += item.finalPrice * item.quantity;
            }
        }

        // Convertir les Maps en tableaux
        const couponStatsArray = Array.from(couponMap.values())
            .map(stat => ({
                ...stat,
                totalDiscount: Number(stat.totalDiscount.toFixed(2))
            }));

        const productsWithCoupons = Array.from(productMap.values())
            .map(stat => ({
                ...stat,
                totalDiscount: Number(stat.totalDiscount.toFixed(2)),
                totalSales: Number(stat.totalSales.toFixed(2))
            }))
            .sort((a, b) => b.totalQuantity - a.totalQuantity);

        res.json({
            couponStats: couponStatsArray,
            salesWithCoupons,
            productsWithCoupons
        });

    } catch (error) {
        console.error('Erreur lors du calcul des statistiques des coupons:', error);
        res.status(500).json({ 
            message: 'Erreur lors du calcul des statistiques des coupons',
            error: error.message,
            stack: error.stack
        });
    }
});

// 2. Route pour les statistiques générales
router.get('/stats', async (req, res) => {
    try {
        const { start, end } = req.query;
        const dateQuery = {};
        if (start && end) {
            dateQuery.date = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }

        // Statistiques globales
        const overallStats = await Sale.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$total" },
                    totalProfit: { $sum: "$profit" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Statistiques par produit
        const productStats = await Sale.aggregate([
            { $match: dateQuery },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$items.product",
                    name: { $first: "$productInfo.name" },
                    totalQuantity: { $sum: "$items.quantity" },
                    totalSales: { 
                        $sum: { 
                            $multiply: ["$items.quantity", "$items.finalPrice"] 
                        }
                    },
                    profit: {
                        $sum: {
                            $multiply: [
                                "$items.quantity",
                                { $subtract: ["$items.finalPrice", "$items.cost"] }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    totalQuantity: 1,
                    totalSales: { $round: ["$totalSales", 2] },
                    profit: { $round: ["$profit", 2] }
                }
            },
            { $sort: { totalSales: -1 } }
        ]);

        // Statistiques par catégorie
        const categoryStats = await Sale.aggregate([
            { $match: dateQuery },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.product",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            {
                $group: {
                    _id: "$productInfo.category",
                    totalSales: { 
                        $sum: { 
                            $multiply: ["$items.quantity", "$items.finalPrice"] 
                        }
                    },
                    profit: {
                        $sum: {
                            $multiply: [
                                "$items.quantity",
                                { $subtract: ["$items.finalPrice", "$items.cost"] }
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    category: "$_id",
                    totalSales: { $round: ["$totalSales", 2] },
                    profit: { $round: ["$profit", 2] }
                }
            },
            { $sort: { totalSales: -1 } }
        ]);

        const result = {
            overall: overallStats[0] || {
                totalSales: 0,
                totalProfit: 0,
                count: 0
            },
            popularProducts: productStats || [],
            categoryStats: categoryStats || []
        };

        console.log('Envoi des données:', JSON.stringify(result, null, 2));
        res.json(result);

    } catch (error) {
        console.error('Erreur détaillée lors du calcul des statistiques:', error);
        res.status(500).json({ 
            message: 'Erreur lors du calcul des statistiques',
            error: error.message,
            stack: error.stack
        });
    }
});

// 3. Route pour obtenir une vente spécifique
router.get('/sales/:id', async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id).populate('items.product');
        if (!sale) {
            return res.status(404).json({ message: 'Vente non trouvée' });
        }
        res.json(sale);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// 4. Route pour obtenir toutes les ventes
router.get('/sales', async (req, res) => {
    try {
        const { start, end } = req.query;
        let query = {};
        
        if (start && end) {
            query.date = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }
        
        const sales = await Sale.find(query)
            .populate({
                path: 'items.product',
                select: 'name price costPrice'
            })
            .populate({
                path: 'coupon',
                select: 'code type value'
            })
            .sort('-date');
            
        res.json(sales);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Obtenir toutes les catégories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find();
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Créer une catégorie
router.post('/categories', async (req, res) => {
    try {
        const category = new Category(req.body);
        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Ajouter ou modifier la route pour obtenir une catégorie spécifique
router.get('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        
        if (!category) {
            return res.status(404).json({ message: 'Catégorie non trouvée' });
        }
        
        res.json(category);
    } catch (error) {
        console.error('Erreur lors de la récupération de la catégorie:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la catégorie' });
    }
});

// Modifier la route pour mettre à jour une catégorie
router.put('/categories/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                active: req.body.active
            },
            { new: true }
        );
        
        if (!category) {
            return res.status(404).json({ message: 'Catégorie non trouvée' });
        }
        
        res.json(category);
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la catégorie:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la catégorie' });
    }
});

// Supprimer une catégorie
router.delete('/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Catégorie supprimée' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour une vente
router.put('/sales/:id', async (req, res) => {
    try {
        const sale = await Sale.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(sale);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Modifier la route de suppression des ventes
router.delete('/sales/:id', async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({ message: 'Vente non trouvée' });
        }

        // Si la vente avait un coupon, décrémenter son compteur d'utilisation
        if (sale.coupon) {
            await Coupon.findByIdAndUpdate(
                sale.coupon,
                { $inc: { usageCount: -1 } }
            );
        }

        // Remettre les stocks à jour
        for (const item of sale.items) {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { stock: item.quantity } }
            );
        }

        await Sale.findByIdAndDelete(req.params.id);
        res.json({ message: 'Vente supprimée' });
    } catch (error) {
        console.error('Erreur lors de la suppression de la vente:', error);
        res.status(500).json({ message: error.message });
    }
});

// Obtenir tous les coupons
router.get('/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Créer un coupon
router.post('/coupons', async (req, res) => {
    try {
        const coupon = new Coupon(req.body);
        await coupon.save();
        res.status(201).json(coupon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Mettre à jour un coupon
router.put('/coupons/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        res.json(coupon);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer un coupon
router.delete('/coupons/:id', async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Coupon supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Ajouter cette route pour obtenir un coupon spécifique
router.get('/coupons/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon non trouvé' });
        }
        res.json(coupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Ajouter cette route
router.get('/check-auth', authMiddleware, (req, res) => {
    res.json({ authenticated: true });
});

// Obtenir tous les utilisateurs
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Créer un utilisateur
router.post('/users', async (req, res) => {
    try {
        const user = new User({
            username: req.body.username,
            password: req.body.password,
            role: req.body.role,
            active: req.body.active
        });
        await user.save();
        const userResponse = user.toObject();
        delete userResponse.password;
        res.status(201).json(userResponse);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Obtenir un utilisateur spécifique
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id, '-password');
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour un utilisateur
router.put('/users/:id', async (req, res) => {
    try {
        const updateData = {
            username: req.body.username,
            role: req.body.role,
            active: req.body.active
        };

        if (req.body.password) {
            updateData.password = await bcrypt.hash(req.body.password, 10);
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, select: '-password' }
        );

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json(user);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Changer le mot de passe
router.put('/users/:id/password', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { password: hashedPassword },
            { new: true, select: '-password' }
        );

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        res.json({ message: 'Mot de passe modifié avec succès' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Supprimer un utilisateur
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }

        // Empêcher la suppression du dernier administrateur
        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
                return res.status(400).json({ 
                    message: 'Impossible de supprimer le dernier administrateur' 
                });
            }
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Utilisateur supprimé' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 