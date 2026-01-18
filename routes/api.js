const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const Ticket = require('../models/Ticket');
const TicketConfig = require('../models/TicketConfig');
const TicketLog = require('../models/TicketLog');
const SMTPConfig = require('../models/SMTPConfig');
const { authMiddleware, adminMiddleware, ticketSellerMiddleware } = require('./auth');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

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

// Configuration pour l'upload de fichiers ZIP (import)
const zipStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const tempDir = path.join(__dirname, '..', 'temp_uploads');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, `import-${Date.now()}.zip`);
    }
});

const uploadZip = multer({
    storage: zipStorage,
    fileFilter: function (req, file, cb) {
        // Accepter les fichiers ZIP et JSON (pour compatibilité)
        if (file.mimetype === 'application/zip' || 
            file.mimetype === 'application/x-zip-compressed' || 
            file.mimetype === 'application/json' ||
            file.originalname.endsWith('.zip') ||
            file.originalname.endsWith('.json')) {
            return cb(null, true);
        }
        cb(new Error('Seuls les fichiers ZIP ou JSON sont autorisés pour l\'import!'));
    },
    limits: { fileSize: 100 * 1024 * 1024 } // 100 MB max
});

// Récupérer tous les produits
router.get('/products', async (req, res) => {
    try {
        console.log('Récupération des produits...'); // Log pour déboguer
        const products = await Product.find().lean();
        
        // Trier les prix par quantité pour chaque produit et ajouter un timestamp pour le cache
        products.forEach(product => {
            if (product.quantityPrices) {
                product.quantityPrices.sort((a, b) => b.quantity - a.quantity);
            }
            
            // Ajouter un paramètre de version basé sur la date de mise à jour pour forcer le rechargement
            if (product.image) {
                // S'assurer que le chemin commence par /uploads/products/ ou est un chemin absolu
                let imagePath = product.image;
                if (!imagePath.startsWith('/') && !imagePath.startsWith('http')) {
                    imagePath = `/uploads/products/${imagePath}`;
                } else if (!imagePath.startsWith('/uploads/products/') && imagePath.startsWith('/uploads/')) {
                    // Si c'est /uploads/ mais pas /uploads/products/, corriger
                    imagePath = imagePath.replace('/uploads/', '/uploads/products/');
                }
                
                const timestamp = product.updatedAt ? new Date(product.updatedAt).getTime() : Date.now();
                product.imageUrl = `${imagePath}?v=${timestamp}`;
                product.image = imagePath; // Mettre à jour aussi le chemin original
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
        const saleDateQuery = {};
        const ticketDateQuery = {};
        
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            
            saleDateQuery.date = {
                $gte: startDate,
                $lte: endDate
            };
            
            ticketDateQuery.purchaseDate = {
                $gte: startDate,
                $lte: endDate
            };
        }

        // Statistiques globales des ventes de produits
        const saleStats = await Sale.aggregate([
            { $match: saleDateQuery },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$total" },
                    totalProfit: { $sum: "$profit" },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Statistiques globales des ventes de tickets
        const ticketStats = await Ticket.aggregate([
            { 
                $match: {
                    ...ticketDateQuery,
                    status: { $ne: 'cancelled' } // Exclure les tickets annulés
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    totalProfit: { $sum: "$totalAmount" }, // Les tickets n'ont pas de coût, donc profit = total
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Combiner les statistiques
        const saleResult = saleStats[0] || { totalSales: 0, totalProfit: 0, count: 0 };
        const ticketResult = ticketStats[0] || { totalSales: 0, totalProfit: 0, count: 0 };
        
        const overallStats = [{
            totalSales: saleResult.totalSales + ticketResult.totalSales,
            totalProfit: saleResult.totalProfit + ticketResult.totalProfit,
            count: saleResult.count + ticketResult.count
        }];

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

// 4. Route pour obtenir toutes les ventes (produits + tickets)
router.get('/sales', async (req, res) => {
    try {
        const { start, end } = req.query;
        let saleQuery = {};
        let ticketQuery = {};
        
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999); // Inclure toute la journée de fin
            
            saleQuery.date = {
                $gte: startDate,
                $lte: endDate
            };
            
            ticketQuery.purchaseDate = {
                $gte: startDate,
                $lte: endDate
            };
        }
        
        // Récupérer les ventes de produits
        const productSales = await Sale.find(saleQuery)
            .populate({
                path: 'items.product',
                select: 'name price costPrice'
            })
            .populate({
                path: 'coupon',
                select: 'code type value'
            })
            .sort('-date');
        
        // Récupérer les tickets et les regrouper par achat
        const allTickets = await Ticket.find(ticketQuery)
            .populate({
                path: 'soldBy',
                select: 'name email'
            })
            .sort('purchaseDate');
        
        // Regrouper les tickets par achat (même email, même date d'achat proche)
        const ticketGroups = new Map();
        const timeWindow = 10 * 1000; // 10 secondes
        
        allTickets.forEach(ticket => {
            if (ticket.status === 'cancelled') return; // Ignorer les tickets annulés
            
            const key = `${ticket.email}_${ticket.purchaseDate.getTime()}`;
            
            if (!ticketGroups.has(key)) {
                ticketGroups.set(key, {
                    tickets: [],
                    email: ticket.email,
                    purchaseDate: ticket.purchaseDate,
                    totalAmount: 0,
                    quantity: 0
                });
            }
            
            const group = ticketGroups.get(key);
            group.tickets.push(ticket);
            group.totalAmount += ticket.totalAmount;
            group.quantity += 1;
        });
        
        // Convertir les groupes de tickets en format de vente
        const ticketSales = Array.from(ticketGroups.values()).map(group => ({
            _id: `ticket_${group.tickets[0]._id}`,
            type: 'ticket',
            date: group.purchaseDate,
            items: [{
                product: {
                    name: `Moitié-Moitié (${group.quantity} billet${group.quantity > 1 ? 's' : ''})`,
                    price: group.totalAmount / group.quantity,
                    costPrice: 0
                },
                quantity: group.quantity,
                price: group.totalAmount / group.quantity,
                cost: 0,
                discount: 0,
                finalPrice: group.totalAmount / group.quantity
            }],
            total: group.totalAmount,
            originalTotal: group.totalAmount,
            discount: 0,
            profit: group.totalAmount, // Les tickets n'ont pas de coût
            coupon: null,
            paymentMethod: group.tickets[0].paymentMethod || 'cash',
            amountReceived: group.totalAmount,
            email: group.email,
            ticketNumbers: group.tickets.map(t => t.ticketNumber)
        }));
        
        // Combiner les ventes de produits et de tickets, puis trier par date
        const allSales = [...productSales.map(sale => ({ ...sale.toObject(), type: 'product' })), ...ticketSales]
            .sort((a, b) => new Date(b.date) - new Date(a.date));
            
        res.json(allSales);
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
    res.json({ 
        authenticated: true,
        user: {
            id: req.user._id,
            username: req.user.username,
            role: req.user.role
        }
    });
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

// ============================================
// ROUTES D'EXPORT/IMPORT DE DONNÉES
// ============================================

// Exporter toutes les données (admin seulement)
router.get('/export', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const {
            products = 'true',
            categories = 'true',
            coupons = 'true',
            users = 'false',
            sales = 'false'
        } = req.query;

        const data = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            exportOptions: {
                products: products === 'true',
                categories: categories === 'true',
                coupons: coupons === 'true',
                users: users === 'true',
                sales: sales === 'true'
            }
        };

        // Ajouter les données selon les options
        if (products === 'true') {
            data.products = await Product.find().lean();
        }
        
        if (categories === 'true') {
            data.categories = await Category.find().lean();
        }
        
        if (coupons === 'true') {
            data.coupons = await Coupon.find().lean();
        }
        
        if (users === 'true') {
            data.users = await User.find().select('-password').lean();
        }
        
        if (sales === 'true') {
            data.sales = await Sale.find().lean();
        }

        // Créer un fichier ZIP avec les données JSON et les images
        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression maximale
        });

        // Configurer les en-têtes pour le téléchargement ZIP
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="cantine-export-${Date.now()}.zip"`);

        // Pipe l'archive vers la réponse
        archive.pipe(res);

        // Ajouter le fichier JSON
        archive.append(JSON.stringify(data, null, 2), { name: 'data.json' });

        // Collecter et ajouter les images des produits
        if (products === 'true' && data.products) {
            const imagePaths = new Set();
            
            // Collecter tous les chemins d'images uniques
            data.products.forEach(product => {
                if (product.image && product.image.startsWith('/uploads/products/')) {
                    const imagePath = product.image.replace('/uploads/products/', '');
                    imagePaths.add(imagePath);
                }
            });

            // Ajouter chaque image au ZIP
            const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
            
            for (const imagePath of imagePaths) {
                const fullPath = path.join(uploadsDir, imagePath);
                if (fs.existsSync(fullPath)) {
                    archive.file(fullPath, { name: `images/${imagePath}` });
                }
            }
        }

        // Finaliser l'archive
        await archive.finalize();
    } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        res.status(500).json({ message: 'Erreur lors de l\'export des données', error: error.message });
    }
});

// Importer des données (admin seulement)
// IMPORTANT: multer doit être appelé directement pour accéder au stream brut du body
router.post('/import', authMiddleware, adminMiddleware, uploadZip.single('file'), async (req, res) => {
    let zipFile = null;
    let extractedDir = null;
    
    // Logs de débogage
    console.log('=== IMPORT DEBUG ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body keys:', req.body ? Object.keys(req.body) : 'no body');
    console.log('Body content:', req.body ? JSON.stringify(req.body).substring(0, 100) : 'no body');
    console.log('File:', req.file ? req.file.filename : 'no file');
    console.log('File validation error:', req.fileValidationError);
    
    // Gérer les erreurs multer
    if (req.fileValidationError) {
        return res.status(400).json({ message: req.fileValidationError });
    }
    
    try {
        let data;
        let options = {};
        
        // Initialiser results AVANT de l'utiliser
        const results = {
            products: { imported: 0, errors: [] },
            categories: { imported: 0, errors: [] },
            coupons: { imported: 0, errors: [] },
            users: { imported: 0, errors: [] },
            sales: { imported: 0, errors: [] },
            images: { copied: 0, errors: [] }
        };

        // Si un fichier ZIP est fourni, l'extraire
        if (req.file) {
            zipFile = req.file.path;
            const zip = new AdmZip(zipFile);
            
            // Créer un répertoire temporaire pour l'extraction
            extractedDir = path.join(__dirname, '..', 'temp_uploads', `extracted-${Date.now()}`);
            fs.mkdirSync(extractedDir, { recursive: true });
            
            // Extraire le ZIP
            zip.extractAllTo(extractedDir, true);
            
            // Lire le fichier data.json
            const dataJsonPath = path.join(extractedDir, 'data.json');
            if (!fs.existsSync(dataJsonPath)) {
                return res.status(400).json({ message: 'Fichier data.json introuvable dans le ZIP' });
            }
            
            const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
            const zipData = JSON.parse(dataJsonContent);
            data = zipData;
            
            // Si des options sont fournies dans le body, les utiliser
            if (req.body.options) {
                try {
                    options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
                } catch (e) {
                    console.warn('Erreur lors du parsing des options:', e);
                }
            }
            
            // Copier les images dans le répertoire public/uploads/products
            const imagesDir = path.join(extractedDir, 'images');
            const targetImagesDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
            
            console.log('=== COPYING IMAGES ===');
            console.log('Images directory:', imagesDir);
            console.log('Target directory:', targetImagesDir);
            console.log('Images dir exists:', fs.existsSync(imagesDir));
            
            // Créer un Map pour stocker les correspondances entre les noms de fichiers
            const imageMap = new Map();
            
            if (fs.existsSync(imagesDir)) {
                // S'assurer que le répertoire de destination existe
                if (!fs.existsSync(targetImagesDir)) {
                    fs.mkdirSync(targetImagesDir, { recursive: true });
                    console.log('Created target directory:', targetImagesDir);
                }
                
                // Copier tous les fichiers d'images
                const imageFiles = fs.readdirSync(imagesDir);
                console.log('Image files found:', imageFiles.length, imageFiles);
                
                for (const imageFile of imageFiles) {
                    const sourcePath = path.join(imagesDir, imageFile);
                    const targetPath = path.join(targetImagesDir, imageFile);
                    
                    // Vérifier que le fichier source existe
                    if (fs.existsSync(sourcePath)) {
                        try {
                            // Vérifier les stats du fichier source
                            const stats = fs.statSync(sourcePath);
                            console.log(`Copying ${imageFile} (${stats.size} bytes)`);
                            
                            // Copier le fichier (écraser si existe déjà)
                            fs.copyFileSync(sourcePath, targetPath);
                            
                            // Vérifier que le fichier a bien été copié
                            if (fs.existsSync(targetPath)) {
                                const targetStats = fs.statSync(targetPath);
                                console.log(`✓ Copied: ${imageFile} (${targetStats.size} bytes)`);
                                
                                // Stocker dans le Map pour référence ultérieure (insensible à la casse)
                                // Stocker aussi avec l'extension en minuscule pour correspondance
                                imageMap.set(imageFile.toLowerCase(), imageFile);
                                // Stocker aussi avec juste le nom en minuscule (sans extension) pour correspondance flexible
                                const nameWithoutExt = path.parse(imageFile).name.toLowerCase();
                                imageMap.set(nameWithoutExt, imageFile);
                                
                                results.images.copied++;
                            } else {
                                console.error(`✗ File not found after copy: ${targetPath}`);
                                results.images.errors.push({ file: imageFile, error: 'File not found after copy' });
                            }
                        } catch (copyError) {
                            console.error(`✗ Error copying ${imageFile}:`, copyError);
                            results.images.errors.push({ file: imageFile, error: copyError.message });
                        }
                    } else {
                        console.warn(`✗ Source file does not exist: ${sourcePath}`);
                        results.images.errors.push({ file: imageFile, error: 'Source file not found' });
                    }
                }
                console.log(`=== Total images copied: ${results.images.copied} / ${imageFiles.length} ===`);
                console.log('Image map:', Array.from(imageMap.entries()));
            } else {
                console.log('Images directory does not exist:', imagesDir);
            }
            
            // Stocker le imageMap dans req pour l'utiliser lors de l'import des produits
            req.importedImages = imageMap;
        } else {
            // Fallback : utiliser les données du body (compatibilité avec l'ancien format)
            data = req.body.data;
            if (req.body.options) {
                options = typeof req.body.options === 'string' ? JSON.parse(req.body.options) : req.body.options;
            }
        }
        
        if (!data) {
            return res.status(400).json({ message: 'Aucune donnée fournie' });
        }

        const {
            importProducts = true,
            importCategories = true,
            importCoupons = true,
            importUsers = false,
            importSales = false,
            overwrite = false // Si true, remplace les données existantes
        } = options;

        // results est déjà initialisé au début du try block

        // Importer les catégories en premier (car les produits en dépendent)
        if (importCategories && data.categories) {
            for (const categoryData of data.categories) {
                try {
                    if (overwrite) {
                        await Category.findOneAndUpdate(
                            { name: categoryData.name },
                            categoryData,
                            { upsert: true, new: true }
                        );
                    } else {
                        const existing = await Category.findOne({ name: categoryData.name });
                        if (!existing) {
                            await Category.create(categoryData);
                        }
                    }
                    results.categories.imported++;
                } catch (error) {
                    results.categories.errors.push({ name: categoryData.name, error: error.message });
                }
            }
        }

        // Importer les produits
        if (importProducts && data.products) {
            for (const productData of data.products) {
                try {
                    // Supprimer _id pour éviter les conflits
                    delete productData._id;
                    delete productData.__v;
                    
                    // S'assurer que le chemin de l'image est correct
                    if (productData.image) {
                        // Extraire le nom du fichier du chemin (peut être /uploads/products/filename.jpg ou juste filename.jpg)
                        let imageName = path.basename(productData.image);
                        
                        // Si le chemin contient /uploads/products/, extraire juste le nom
                        if (productData.image.includes('/uploads/products/')) {
                            imageName = productData.image.replace(/^.*\/uploads\/products\//, '');
                        }
                        
                        // Si on a un Map d'images importées, vérifier la correspondance (insensible à la casse)
                        if (req.importedImages && req.importedImages.size > 0) {
                            // Essayer d'abord avec le nom complet en minuscule
                            let foundImage = req.importedImages.get(imageName.toLowerCase());
                            
                            // Si pas trouvé, essayer avec juste le nom sans extension
                            if (!foundImage) {
                                const nameWithoutExt = path.parse(imageName).name.toLowerCase();
                                foundImage = req.importedImages.get(nameWithoutExt);
                            }
                            
                            if (foundImage) {
                                // Utiliser le nom exact du fichier copié (avec la bonne casse et extension)
                                imageName = foundImage;
                                console.log(`Matched image for product ${productData.name}: ${imageName}`);
                            } else {
                                console.warn(`No match found in imported images for: ${imageName}`);
                            }
                        }
                        
                        // Vérifier que le fichier existe dans le répertoire de destination
                        const targetImagesDir = path.join(__dirname, '..', 'public', 'uploads', 'products');
                        const imagePath = path.join(targetImagesDir, imageName);
                        
                        if (fs.existsSync(imagePath)) {
                            // Le fichier existe, utiliser le chemin correct
                            productData.image = `/uploads/products/${imageName}`;
                            console.log(`✓ Image path updated for product ${productData.name}: ${productData.image}`);
                        } else {
                            // Le fichier n'existe pas - chercher dans tous les fichiers disponibles
                            if (fs.existsSync(targetImagesDir)) {
                                const allFiles = fs.readdirSync(targetImagesDir);
                                
                                // Essayer de trouver le fichier avec correspondance insensible à la casse
                                const foundFile = allFiles.find(f => {
                                    // Correspondance exacte (insensible à la casse)
                                    if (f.toLowerCase() === imageName.toLowerCase()) {
                                        return true;
                                    }
                                    // Correspondance par nom sans extension
                                    const fName = path.parse(f).name.toLowerCase();
                                    const imgName = path.parse(imageName).name.toLowerCase();
                                    return fName === imgName;
                                });
                                
                                if (foundFile) {
                                    imageName = foundFile;
                                    productData.image = `/uploads/products/${imageName}`;
                                    console.log(`✓ Found image with different case/extension for product ${productData.name}: ${productData.image}`);
                                } else {
                                    console.warn(`✗ Image file not found for product ${productData.name}`);
                                    console.warn(`  Searched for: ${imageName}`);
                                    console.warn(`  Original path in data: ${productData.image}`);
                                    console.warn(`  Available files (first 10): ${allFiles.slice(0, 10).join(', ')}`);
                                    
                                    // Essayer de trouver par nom de base (sans extension)
                                    const baseName = path.parse(imageName).name.toLowerCase();
                                    const foundByBase = allFiles.find(f => path.parse(f).name.toLowerCase() === baseName);
                                    if (foundByBase) {
                                        imageName = foundByBase;
                                        productData.image = `/uploads/products/${imageName}`;
                                        console.log(`✓ Found image by base name for product ${productData.name}: ${productData.image}`);
                                    } else {
                                        // Garder le chemin original, peut-être que l'image sera ajoutée plus tard
                                        productData.image = `/uploads/products/${imageName}`;
                                        console.warn(`  Keeping original path: ${productData.image}`);
                                    }
                                }
                            } else {
                                console.error(`✗ Target images directory does not exist: ${targetImagesDir}`);
                                productData.image = `/uploads/products/${imageName}`;
                            }
                        }
                    }
                    
                    if (overwrite) {
                        await Product.findOneAndUpdate(
                            { name: productData.name },
                            productData,
                            { upsert: true, new: true }
                        );
                    } else {
                        const existing = await Product.findOne({ name: productData.name });
                        if (!existing) {
                            await Product.create(productData);
                        }
                    }
                    results.products.imported++;
                } catch (error) {
                    results.products.errors.push({ name: productData.name, error: error.message });
                }
            }
        }

        // Importer les coupons
        if (importCoupons && data.coupons) {
            for (const couponData of data.coupons) {
                try {
                    delete couponData._id;
                    delete couponData.__v;
                    
                    if (overwrite) {
                        await Coupon.findOneAndUpdate(
                            { code: couponData.code },
                            couponData,
                            { upsert: true, new: true }
                        );
                    } else {
                        const existing = await Coupon.findOne({ code: couponData.code });
                        if (!existing) {
                            await Coupon.create(couponData);
                        }
                    }
                    results.coupons.imported++;
                } catch (error) {
                    results.coupons.errors.push({ code: couponData.code, error: error.message });
                }
            }
        }

        // Importer les utilisateurs (optionnel et dangereux)
        if (importUsers && data.users) {
            for (const userData of data.users) {
                try {
                    delete userData._id;
                    delete userData.__v;
                    // Ne pas importer les mots de passe pour des raisons de sécurité
                    delete userData.password;
                    
                    if (overwrite) {
                        await User.findOneAndUpdate(
                            { username: userData.username },
                            userData,
                            { upsert: true, new: true }
                        );
                    } else {
                        const existing = await User.findOne({ username: userData.username });
                        if (!existing) {
                            // Créer un utilisateur avec un mot de passe par défaut
                            const newUser = new User({
                                ...userData,
                                password: 'changeme123' // L'utilisateur devra changer le mot de passe
                            });
                            await newUser.save();
                        }
                    }
                    results.users.imported++;
                } catch (error) {
                    results.users.errors.push({ username: userData.username, error: error.message });
                }
            }
        }

        // Importer les ventes (optionnel)
        if (importSales && data.sales) {
            for (const saleData of data.sales) {
                try {
                    delete saleData._id;
                    delete saleData.__v;
                    await Sale.create(saleData);
                    results.sales.imported++;
                } catch (error) {
                    results.sales.errors.push({ date: saleData.date, error: error.message });
                }
            }
        }

        res.json({
            success: true,
            message: 'Import terminé',
            results
        });
    } catch (error) {
        console.error('Erreur lors de l\'import:', error);
        res.status(500).json({ message: 'Erreur lors de l\'import des données', error: error.message });
    }
});

// ============================================
// ROUTES POUR LA VENTE DE COUPONS (TICKETS)
// ============================================

// Configuration du transporteur email
const createEmailTransporter = async () => {
    // Essayer d'abord d'utiliser la configuration de la base de données
    try {
        const smtpConfig = await SMTPConfig.findOne({ active: true });
        if (smtpConfig) {
            return nodemailer.createTransport({
                host: smtpConfig.host,
                port: smtpConfig.port,
                secure: smtpConfig.secure,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.password
                }
            });
        }
    } catch (error) {
        console.warn('Erreur lors de la récupération de la configuration SMTP:', error);
    }
    
    // Fallback sur les variables d'environnement
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('Configuration SMTP manquante. Les emails ne seront pas envoyés.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Obtenir l'adresse email "from"
const getEmailFrom = async () => {
    try {
        const smtpConfig = await SMTPConfig.findOne({ active: true });
        if (smtpConfig && smtpConfig.from) {
            // Si un nom est configuré, l'utiliser
            if (smtpConfig.fromName) {
                return `"${smtpConfig.fromName}" <${smtpConfig.from}>`;
            }
            return smtpConfig.from;
        }
    } catch (error) {
        console.warn('Erreur lors de la récupération de l\'adresse from:', error);
    }
    
    return process.env.SMTP_FROM || process.env.SMTP_USER;
};

// Générer un numéro de ticket unique (uniquement des chiffres)
async function generateTicketNumber() {
    let ticketNumber;
    let exists = true;
    
    while (exists) {
        // Format: YYYYMMDD-XXXXXXXX (ex: 20240116-12345678)
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const random = Math.floor(10000000 + Math.random() * 90000000); // 8 chiffres aléatoires
        ticketNumber = `${date}-${random}`;
        
        const existing = await Ticket.findOne({ ticketNumber });
        exists = !!existing;
    }
    
    return ticketNumber;
}

// Calculer le prix d'un ticket en fonction de la quantité et des offres
async function calculateTicketPrice(quantity) {
    const config = await TicketConfig.findOne({ active: true });
    
    if (!config) {
        // Configuration par défaut si aucune config n'existe
        return quantity * 0.50;
    }
    
    // Chercher une offre exacte correspondant à la quantité
    const exactOffer = config.quantityOffers.find(o => o.quantity === quantity);
    if (exactOffer) {
        return exactOffer.price;
    }
    
    // Si quantité = 1 et aucune offre pour 1, utiliser le prix de base
    if (quantity === 1) {
        return config.basePrice;
    }
    
    // Si aucune offre exacte, utiliser le prix de base
    return quantity * config.basePrice;
}

// Obtenir la configuration des tickets (publique pour le calcul côté client)
router.get('/tickets/config', async (req, res) => {
    try {
        const config = await TicketConfig.findOne({ active: true });
        
        if (!config) {
            // Retourner une configuration par défaut
            return res.json({
                basePrice: 0.50,
                quantityOffers: []
            });
        }
        
        res.json({
            basePrice: config.basePrice,
            quantityOffers: config.quantityOffers.sort((a, b) => a.quantity - b.quantity)
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la configuration:', error);
        res.status(500).json({ message: error.message });
    }
});

// Middleware d'authentification optionnel (ne bloque pas si non authentifié)
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.userId);
                if (user && user.active) {
                    req.user = user;
                }
            } catch (error) {
                // Ignorer les erreurs d'authentification, continuer sans utilisateur
            }
        }
        next();
    } catch (error) {
        next();
    }
};

// Acheter des coupons (route publique mais avec authentification optionnelle pour tracker le vendeur)
router.post('/tickets/purchase', optionalAuthMiddleware, async (req, res) => {
    try {
        const { email, quantity, totalAmount, paymentMethod = 'cash' } = req.body;
        
        // Récupérer l'utilisateur si authentifié (pour tracker le vendeur)
        const sellerId = req.user ? req.user._id : null;
        
        // Validation
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Email invalide' });
        }
        
        if (!quantity || quantity < 1 || quantity > 100) {
            return res.status(400).json({ message: 'Quantité invalide (1-100)' });
        }
        
        // Vérifier que la quantité correspond à une offre configurée
        const config = await TicketConfig.findOne({ active: true });
        
        if (!config) {
            // Si aucune config, accepter n'importe quelle quantité avec le prix de base
            const expectedPrice = quantity * 0.50;
            if (!totalAmount || Math.abs(totalAmount - expectedPrice) > 0.01) {
                return res.status(400).json({ 
                    message: `Montant invalide. Le montant attendu pour ${quantity} billet(s) est ${expectedPrice.toFixed(2)}$` 
                });
            }
        } else {
            // Vérifier que la quantité correspond à une offre ou au prix de base (quantité = 1)
            const validQuantities = config.quantityOffers.map(o => o.quantity);
            const isBasePrice = quantity === 1;
            const isOfferQuantity = validQuantities.includes(quantity);
            
            if (!isBasePrice && !isOfferQuantity) {
                return res.status(400).json({ 
                    message: `Quantité invalide. Seules les offres configurées sont disponibles. Quantités disponibles: 1, ${validQuantities.join(', ')}` 
                });
            }
            
            // Calculer le prix attendu selon la configuration
            const expectedPrice = await calculateTicketPrice(quantity);
            
            // Valider que le montant correspond (avec une petite marge d'erreur pour les arrondis)
            if (!totalAmount || Math.abs(totalAmount - expectedPrice) > 0.01) {
                return res.status(400).json({ 
                    message: `Montant invalide. Le montant attendu pour ${quantity} billet(s) est ${expectedPrice.toFixed(2)}$` 
                });
            }
        }
        
        // Générer les numéros de tickets
        const tickets = [];
        const ticketNumbers = [];
        
        for (let i = 0; i < quantity; i++) {
            const ticketNumber = await generateTicketNumber();
            ticketNumbers.push(ticketNumber);
            
            const ticket = new Ticket({
                ticketNumber,
                email: email.toLowerCase().trim(),
                quantity: 1,
                totalAmount: totalAmount / quantity,
                paymentMethod,
                soldBy: sellerId
            });
            
            tickets.push(ticket);
        }
        
        // Sauvegarder tous les tickets
        await Ticket.insertMany(tickets);
        
        // Envoyer l'email avec les numéros
        try {
            const transporter = await createEmailTransporter();
            const emailFrom = await getEmailFrom();
            
            if (transporter) {
                const mailOptions = {
                    from: emailFrom,
                    to: email,
                    subject: `Vos ${quantity} coupon(s) - Cantine`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #0066cc;">Merci pour votre achat !</h2>
                            <p>Vous avez acheté <strong>${quantity}</strong> coupon(s) pour un total de <strong>${totalAmount.toFixed(2)}$</strong>.</p>
                            <p>Voici vos numéros de coupons :</p>
                            <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                ${ticketNumbers.map(num => `<p style="font-size: 18px; font-weight: bold; color: #0066cc; margin: 10px 0;">${num}</p>`).join('')}
                            </div>
                            <p style="color: #666;">Ces numéros vous permettront de participer au tirage au sort. Bonne chance !</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">Cantine - Système de gestion</p>
                        </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
            } else {
                console.log('Email non envoyé - Configuration SMTP manquante');
            }
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            // Ne pas faire échouer la transaction si l'email échoue
        }
        
        res.json({
            success: true,
            message: `${quantity} coupon(s) acheté(s) avec succès`,
            tickets: ticketNumbers,
            email: email
        });
    } catch (error) {
        console.error('Erreur lors de l\'achat de coupons:', error);
        res.status(500).json({ message: 'Erreur lors de l\'achat de coupons', error: error.message });
    }
});

// Trouver les tickets d'un même achat (par email et date d'achat proche)
router.get('/tickets/purchase-group', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ticketId } = req.query;
        
        if (!ticketId) {
            return res.status(400).json({ message: 'ID du ticket requis' });
        }
        
        // Trouver le ticket de référence
        const referenceTicket = await Ticket.findById(ticketId);
        
        if (!referenceTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé' });
        }
        
        // Trouver tous les tickets du même achat (même email, même date d'achat à quelques secondes près)
        // On considère que les tickets d'un même achat sont créés dans un intervalle de 10 secondes
        const timeWindow = 10 * 1000; // 10 secondes en millisecondes
        const startTime = new Date(referenceTicket.purchaseDate.getTime() - timeWindow);
        const endTime = new Date(referenceTicket.purchaseDate.getTime() + timeWindow);
        
        const tickets = await Ticket.find({
            email: referenceTicket.email,
            purchaseDate: {
                $gte: startTime,
                $lte: endTime
            },
            status: { $ne: 'cancelled' }
        }).sort({ purchaseDate: 1 });
        
        res.json({
            success: true,
            tickets: tickets.map(t => ({
                _id: t._id,
                ticketNumber: t.ticketNumber,
                email: t.email,
                purchaseDate: t.purchaseDate,
                totalAmount: t.totalAmount
            })),
            totalAmount: tickets.reduce((sum, t) => sum + t.totalAmount, 0),
            quantity: tickets.length
        });
    } catch (error) {
        console.error('Erreur lors de la recherche du groupe de tickets:', error);
        res.status(500).json({ message: error.message });
    }
});

// Modifier l'email d'un lot de tickets et renvoyer l'email
router.post('/tickets/update-email-and-send', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ticketId, newEmail } = req.body;
        
        if (!ticketId || !newEmail) {
            return res.status(400).json({ message: 'ID du ticket et nouveau email requis' });
        }
        
        if (!newEmail.includes('@')) {
            return res.status(400).json({ message: 'Email invalide' });
        }
        
        // Trouver le ticket de référence
        const referenceTicket = await Ticket.findById(ticketId);
        
        if (!referenceTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé' });
        }
        
        // Trouver tous les tickets du même achat
        const timeWindow = 10 * 1000; // 10 secondes
        const startTime = new Date(referenceTicket.purchaseDate.getTime() - timeWindow);
        const endTime = new Date(referenceTicket.purchaseDate.getTime() + timeWindow);
        
        const tickets = await Ticket.find({
            email: referenceTicket.email,
            purchaseDate: {
                $gte: startTime,
                $lte: endTime
            },
            status: { $ne: 'cancelled' }
        });
        
        if (tickets.length === 0) {
            return res.status(404).json({ message: 'Aucun ticket trouvé pour ce groupe' });
        }
        
        // Mettre à jour l'email de tous les tickets
        const ticketNumbers = [];
        const totalAmount = tickets.reduce((sum, t) => sum + t.totalAmount, 0);
        
        for (const ticket of tickets) {
            ticket.email = newEmail.toLowerCase().trim();
            await ticket.save();
            ticketNumbers.push(ticket.ticketNumber);
        }
        
        // Envoyer l'email avec tous les numéros
        try {
            const transporter = await createEmailTransporter();
            const emailFrom = await getEmailFrom();
            
            if (transporter) {
                const mailOptions = {
                    from: emailFrom,
                    to: newEmail,
                    subject: `Vos ${tickets.length} coupon(s) - Cantine`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #0066cc;">Merci pour votre achat !</h2>
                            <p>Vous avez acheté <strong>${tickets.length}</strong> coupon(s) pour un total de <strong>${totalAmount.toFixed(2)}$</strong>.</p>
                            <p>Voici vos numéros de coupons :</p>
                            <div style="background: #f8f8f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                ${ticketNumbers.map(num => `<p style="font-size: 18px; font-weight: bold; color: #0066cc; margin: 10px 0;">${num}</p>`).join('')}
                            </div>
                            <p style="color: #666;">Ces numéros vous permettront de participer au tirage au sort. Bonne chance !</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">Cantine - Système de gestion</p>
                        </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                
                res.json({
                    success: true,
                    message: `Email mis à jour et envoyé avec succès pour ${tickets.length} ticket(s)`,
                    ticketsUpdated: tickets.length,
                    ticketNumbers: ticketNumbers
                });
            } else {
                // Mettre à jour quand même même si l'email ne peut pas être envoyé
                res.json({
                    success: true,
                    message: `Email mis à jour pour ${tickets.length} ticket(s), mais l'envoi d'email a échoué (Configuration SMTP manquante)`,
                    ticketsUpdated: tickets.length,
                    ticketNumbers: ticketNumbers,
                    emailSent: false
                });
            }
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email:', emailError);
            // L'email a été mis à jour, mais l'envoi a échoué
            res.json({
                success: true,
                message: `Email mis à jour pour ${tickets.length} ticket(s), mais l'envoi d'email a échoué`,
                ticketsUpdated: tickets.length,
                ticketNumbers: ticketNumbers,
                emailSent: false,
                emailError: emailError.message
            });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'email:', error);
        res.status(500).json({ message: error.message });
    }
});

// Envoyer l'email au gagnant (admin seulement)
router.post('/tickets/draw/send-email', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ticketId } = req.body;
        
        if (!ticketId) {
            return res.status(400).json({ message: 'ID du ticket requis' });
        }
        
        const winner = await Ticket.findById(ticketId);
        
        if (!winner) {
            return res.status(404).json({ message: 'Ticket non trouvé' });
        }
        
        if (!winner.isWinner) {
            return res.status(400).json({ message: 'Ce ticket n\'est pas un gagnant' });
        }
        
        // Envoyer un email au gagnant
        try {
            const transporter = await createEmailTransporter();
            const emailFrom = await getEmailFrom();
            
            if (transporter) {
                const mailOptions = {
                    from: emailFrom,
                    to: winner.email,
                    subject: '🎉 Félicitations ! Vous avez gagné !',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #16a34a;">🎉 Félicitations !</h2>
                            <p>Votre numéro de coupon <strong style="color: #0066cc; font-size: 20px;">${winner.ticketNumber}</strong> a été tiré au sort et vous avez gagné !</p>
                            <p>Nous vous contacterons bientôt pour vous remettre votre prix.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px;">Cantine - Système de gestion</p>
                        </div>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                
                res.json({
                    success: true,
                    message: 'Email envoyé avec succès au gagnant'
                });
            } else {
                res.status(500).json({ message: 'Configuration SMTP manquante' });
            }
        } catch (emailError) {
            console.error('Erreur lors de l\'envoi de l\'email au gagnant:', emailError);
            res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email', error: emailError.message });
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email:', error);
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les statistiques de vente par vendeur (admin seulement)
router.get('/tickets/seller-report', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Construire le filtre de date si fourni
        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.purchaseDate = {};
            if (startDate) {
                dateFilter.purchaseDate.$gte = new Date(startDate);
            }
            if (endDate) {
                dateFilter.purchaseDate.$lte = new Date(endDate);
                // Inclure toute la journée de fin
                dateFilter.purchaseDate.$lte.setHours(23, 59, 59, 999);
            }
        }
        
        // Agréger les ventes par vendeur
        const sellerStats = await Ticket.aggregate([
            { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: '$soldBy',
                    totalTickets: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalQuantity: { $sum: '$quantity' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'seller'
                }
            },
            {
                $unwind: {
                    path: '$seller',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    sellerId: '$_id',
                    sellerName: {
                        $cond: {
                            if: { $eq: ['$seller', null] },
                            then: 'Non assigné',
                            else: '$seller.username'
                        }
                    },
                    sellerEmail: {
                        $cond: {
                            if: { $eq: ['$seller', null] },
                            then: null,
                            else: '$seller.email'
                        }
                    },
                    totalTickets: 1,
                    totalAmount: { $round: ['$totalAmount', 2] },
                    totalQuantity: 1
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);
        
        // Calculer les totaux globaux
        const totalStats = await Ticket.aggregate([
            { $match: { ...dateFilter, status: { $ne: 'cancelled' } } },
            {
                $group: {
                    _id: null,
                    totalTickets: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' },
                    totalQuantity: { $sum: '$quantity' }
                }
            }
        ]);
        
        res.json({
            sellers: sellerStats,
            totals: totalStats[0] || { totalTickets: 0, totalAmount: 0, totalQuantity: 0 }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du rapport des vendeurs:', error);
        res.status(500).json({ message: error.message });
    }
});

// Obtenir tous les tickets (admin seulement)
router.get('/tickets', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { email, isWinner, status, page = 1, limit = 50 } = req.query;
        
        const query = {};
        if (email) query.email = email.toLowerCase();
        if (isWinner !== undefined) query.isWinner = isWinner === 'true';
        if (status) query.status = status;
        
        const tickets = await Ticket.find(query)
            .populate('cancelledBy', 'username')
            .sort('-purchaseDate')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();
        
        const total = await Ticket.countDocuments(query);
        
        res.json({
            tickets,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des tickets:', error);
        res.status(500).json({ message: error.message });
    }
});

// Obtenir les statistiques des tickets (admin seulement)
router.get('/tickets/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const totalTickets = await Ticket.countDocuments();
        const totalWinners = await Ticket.countDocuments({ isWinner: true });
        const totalAmount = await Ticket.aggregate([
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        const ticketsByEmail = await Ticket.aggregate([
            { $group: { _id: '$email', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        res.json({
            totalTickets,
            totalWinners,
            totalAmount: totalAmount[0]?.total || 0,
            topBuyers: ticketsByEmail
        });
    } catch (error) {
        console.error('Erreur lors du calcul des statistiques:', error);
        res.status(500).json({ message: error.message });
    }
});

// Annuler un billet (admin seulement)
router.post('/tickets/:ticketId/cancel', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { reason } = req.body;
        
        // Valider que la raison est fournie
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ message: 'La raison de l\'annulation est obligatoire' });
        }
        
        // Trouver le billet
        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ message: 'Billet non trouvé' });
        }
        
        // Vérifier que le billet n'est pas déjà annulé
        if (ticket.status === 'cancelled') {
            return res.status(400).json({ message: 'Ce billet est déjà annulé' });
        }
        
        // Vérifier que le billet n'est pas un gagnant
        if (ticket.isWinner) {
            return res.status(400).json({ message: 'Impossible d\'annuler un billet gagnant' });
        }
        
        // Créer un log d'annulation
        const log = new TicketLog({
            ticketNumber: ticket.ticketNumber,
            action: 'cancelled',
            email: ticket.email,
            quantity: ticket.quantity,
            totalAmount: ticket.totalAmount,
            cancelledBy: req.user._id,
            cancelledAt: new Date(),
            reason: reason.trim(),
            originalPurchaseDate: ticket.purchaseDate
        });
        await log.save();
        
        // Mettre à jour le statut du billet
        ticket.status = 'cancelled';
        ticket.cancelledAt = new Date();
        ticket.cancelledBy = req.user._id;
        ticket.cancellationReason = reason.trim();
        await ticket.save();
        
        res.json({
            success: true,
            message: 'Billet annulé avec succès',
            ticket: ticket,
            log: log
        });
    } catch (error) {
        console.error('Erreur lors de l\'annulation du billet:', error);
        res.status(500).json({ message: 'Erreur lors de l\'annulation du billet', error: error.message });
    }
});

// Supprimer tous les billets (admin seulement) - Réinitialiser le tirage
router.delete('/tickets/all', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Vérifier la confirmation
        const { confirm } = req.body;
        if (confirm !== 'DELETE_ALL_TICKETS') {
            return res.status(400).json({ message: 'Confirmation requise pour supprimer tous les billets' });
        }
        
        // Supprimer tous les billets
        const result = await Ticket.deleteMany({});
        
        // Supprimer aussi tous les logs (optionnel - vous pouvez commenter cette ligne si vous voulez garder les logs)
        // await TicketLog.deleteMany({});
        
        res.json({
            success: true,
            message: `Tous les billets ont été supprimés (${result.deletedCount} billet(s))`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de tous les billets:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de tous les billets', error: error.message });
    }
});

// Obtenir les logs d'annulation (admin seulement)
router.get('/tickets/logs', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 50, action } = req.query;
        
        const query = {};
        if (action) query.action = action;
        
        const logs = await TicketLog.find(query)
            .populate('cancelledBy', 'username')
            .sort('-createdAt')
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .lean();
        
        const total = await TicketLog.countDocuments(query);
        
        res.json({
            logs,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des logs:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des logs', error: error.message });
    }
});

// Tirer au sort un gagnant (admin seulement)
router.post('/tickets/draw', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { excludeWinners = true } = req.body;
        
        // Construire la requête - exclure les gagnants ET les billets annulés
        const query = { 
            isWinner: false,
            status: { $ne: 'cancelled' } // Exclure les billets annulés
        };
        if (excludeWinners) {
            query.isWinner = false;
        }
        
        // Compter les tickets éligibles
        const eligibleCount = await Ticket.countDocuments(query);
        
        if (eligibleCount === 0) {
            return res.status(400).json({ message: 'Aucun ticket éligible pour le tirage' });
        }
        
        // Sélectionner un ticket aléatoire
        const randomIndex = Math.floor(Math.random() * eligibleCount);
        const winner = await Ticket.findOne(query).skip(randomIndex);
        
        if (!winner) {
            return res.status(404).json({ message: 'Erreur lors de la sélection du gagnant' });
        }
        
        // Marquer comme gagnant
        winner.isWinner = true;
        winner.winnerDate = new Date();
        await winner.save();
        
        res.json({
            success: true,
            message: 'Gagnant sélectionné avec succès',
            winner: {
                ticketNumber: winner.ticketNumber,
                email: winner.email,
                purchaseDate: winner.purchaseDate,
                _id: winner._id
            }
        });
    } catch (error) {
        console.error('Erreur lors du tirage au sort:', error);
        res.status(500).json({ message: 'Erreur lors du tirage au sort', error: error.message });
    }
});

// Obtenir les statistiques des tickets pour un vendeur (ticket_seller seulement)
router.get('/tickets/seller/stats', authMiddleware, ticketSellerMiddleware, async (req, res) => {
    try {
        // Statistiques globales
        const totalTickets = await Ticket.countDocuments();
        const totalAmount = await Ticket.aggregate([
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        // Statistiques du jour
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayTickets = await Ticket.countDocuments({
            purchaseDate: { $gte: today, $lt: tomorrow }
        });
        
        const todayAmount = await Ticket.aggregate([
            { $match: { purchaseDate: { $gte: today, $lt: tomorrow } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        res.json({
            total: {
                tickets: totalTickets,
                amount: totalAmount[0]?.total || 0
            },
            today: {
                tickets: todayTickets,
                amount: todayAmount[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques de tickets:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des statistiques', error: error.message });
    }
});

// Réinitialiser un gagnant (admin seulement)
router.put('/tickets/:id/reset-winner', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const ticket = await Ticket.findById(req.params.id);
        
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket non trouvé' });
        }
        
        ticket.isWinner = false;
        ticket.winnerDate = null;
        await ticket.save();
        
        res.json({ success: true, message: 'Gagnant réinitialisé' });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================
// ROUTES POUR LA CONFIGURATION DES TICKETS (ADMIN)
// ============================================

// Obtenir la configuration actuelle (admin seulement)
router.get('/tickets/config/admin', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const config = await TicketConfig.findOne({ active: true });
        
        if (!config) {
            // Créer une configuration par défaut
            const defaultConfig = new TicketConfig({
                basePrice: 0.50,
                quantityOffers: [],
                active: true
            });
            await defaultConfig.save();
            return res.json(defaultConfig);
        }
        
        res.json(config);
    } catch (error) {
        console.error('Erreur lors de la récupération de la configuration:', error);
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour la configuration (admin seulement)
router.put('/tickets/config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { basePrice, quantityOffers } = req.body;
        
        // Validation
        if (basePrice === undefined || basePrice < 0) {
            return res.status(400).json({ message: 'Prix de base invalide' });
        }
        
        if (!Array.isArray(quantityOffers)) {
            return res.status(400).json({ message: 'Les offres doivent être un tableau' });
        }
        
        // Valider les offres
        for (const offer of quantityOffers) {
            if (!offer.quantity || offer.quantity < 1) {
                return res.status(400).json({ message: 'Quantité d\'offre invalide' });
            }
            if (offer.price === undefined || offer.price < 0) {
                return res.status(400).json({ message: 'Prix d\'offre invalide' });
            }
        }
        
        // Vérifier qu'il n'y a pas de quantités en double
        const quantities = quantityOffers.map(o => o.quantity);
        if (new Set(quantities).size !== quantities.length) {
            return res.status(400).json({ message: 'Les quantités doivent être uniques' });
        }
        
        // Désactiver l'ancienne configuration
        await TicketConfig.updateMany({ active: true }, { active: false });
        
        // Créer la nouvelle configuration
        const config = new TicketConfig({
            basePrice,
            quantityOffers: quantityOffers.map(o => ({
                quantity: parseInt(o.quantity),
                price: parseFloat(o.price)
            })),
            active: true
        });
        
        await config.save();
        
        res.json({
            success: true,
            message: 'Configuration mise à jour avec succès',
            config
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la configuration:', error);
        res.status(500).json({ message: error.message });
    }
});

// ============================================
// ROUTES POUR LA CONFIGURATION SMTP (ADMIN)
// ============================================

// Obtenir la configuration SMTP actuelle (admin seulement)
router.get('/smtp/config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const config = await SMTPConfig.findOne({ active: true });
        
        if (!config) {
            // Retourner une configuration vide (sans mot de passe)
            return res.json({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true' || false,
                user: process.env.SMTP_USER || '',
                from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
                fromName: 'Cantine',
                hasPassword: !!process.env.SMTP_PASS
            });
        }
        
        // Ne pas retourner le mot de passe en clair
        res.json({
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.user,
            from: config.from,
            fromName: config.fromName || 'Cantine',
            hasPassword: !!config.password
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la configuration SMTP:', error);
        res.status(500).json({ message: error.message });
    }
});

// Mettre à jour la configuration SMTP (admin seulement)
router.put('/smtp/config', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { host, port, secure, user, password, from, fromName } = req.body;
        
        // Validation
        if (!host || !user || !from) {
            return res.status(400).json({ message: 'Les champs host, user et from sont requis' });
        }
        
        if (!port || port < 1 || port > 65535) {
            return res.status(400).json({ message: 'Le port doit être entre 1 et 65535' });
        }
        
        if (!from.includes('@')) {
            return res.status(400).json({ message: 'L\'adresse email "from" est invalide' });
        }
        
        // Désactiver l'ancienne configuration
        await SMTPConfig.updateMany({ active: true }, { active: false });
        
        // Vérifier si une configuration existe déjà avec le même user
        const existingConfig = await SMTPConfig.findOne({ user, active: false });
        
        let config;
        if (existingConfig && password) {
            // Mettre à jour la configuration existante
            existingConfig.host = host;
            existingConfig.port = parseInt(port);
            existingConfig.secure = secure === true || secure === 'true';
            existingConfig.password = password;
            existingConfig.from = from;
            existingConfig.fromName = fromName || 'Cantine';
            existingConfig.active = true;
            config = await existingConfig.save();
        } else {
            // Créer une nouvelle configuration
            config = new SMTPConfig({
                host,
                port: parseInt(port),
                secure: secure === true || secure === 'true',
                user,
                password: password || '', // Si pas de mot de passe fourni, garder l'ancien
                from,
                fromName: fromName || 'Cantine',
                active: true
            });
            
            // Si pas de mot de passe fourni et qu'une config existe, utiliser l'ancien mot de passe
            if (!password && existingConfig) {
                config.password = existingConfig.password;
            }
            
            await config.save();
        }
        
        // Tester la configuration en créant un transporteur
        try {
            const testTransporter = nodemailer.createTransport({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: {
                    user: config.user,
                    pass: config.password
                }
            });
            
            await testTransporter.verify();
            
            res.json({
                success: true,
                message: 'Configuration SMTP sauvegardée et testée avec succès',
                config: {
                    host: config.host,
                    port: config.port,
                    secure: config.secure,
                    user: config.user,
                    from: config.from,
                    fromName: config.fromName
                }
            });
        } catch (testError) {
            // La configuration est sauvegardée mais le test a échoué
            res.status(400).json({
                success: false,
                message: 'Configuration sauvegardée mais le test de connexion a échoué. Vérifiez vos paramètres.',
                error: testError.message
            });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la configuration SMTP:', error);
        res.status(500).json({ message: error.message });
    }
});

// Tester la configuration SMTP (admin seulement)
router.post('/smtp/test', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { testEmail } = req.body;
        
        if (!testEmail || !testEmail.includes('@')) {
            return res.status(400).json({ message: 'Adresse email de test invalide' });
        }
        
        const transporter = await createEmailTransporter();
        const emailFrom = await getEmailFrom();
        
        if (!transporter) {
            return res.status(400).json({ message: 'Configuration SMTP non disponible' });
        }
        
        const mailOptions = {
            from: emailFrom,
            to: testEmail,
            subject: 'Test de configuration SMTP - Cantine',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0066cc;">Test de configuration SMTP</h2>
                    <p>Si vous recevez cet email, cela signifie que votre configuration SMTP fonctionne correctement !</p>
                    <p>Date du test: ${new Date().toLocaleString('fr-FR')}</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Cantine - Système de gestion</p>
                </div>
            `
        };
        
        await transporter.sendMail(mailOptions);
        
        res.json({
            success: true,
            message: `Email de test envoyé avec succès à ${testEmail}`
        });
    } catch (error) {
        console.error('Erreur lors du test SMTP:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de l\'envoi de l\'email de test',
            error: error.message
        });
    }
});

module.exports = router; 