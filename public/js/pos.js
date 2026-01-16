let cart = [];
let products = [];
let currentCoupon = null;
let subtotal = 0;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier l'authentification
    await checkAuth();
    
    await Promise.all([
        setupCategories(),
        loadProducts(),
        loadAvailableCoupons()
    ]);
    setupEventListeners();
});

// Vérifier l'authentification
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        if (!response.ok) {
            // Rediriger vers la page de login avec returnTo
            window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
            return;
        }
    } catch (error) {
        console.error('Erreur de vérification d\'authentification:', error);
        window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
    }
}

// Chargement des données
async function setupCategories() {
    try {
        const response = await fetch('/api/categories');
        
        // Vérifier si l'utilisateur a été déconnecté
        if (response.status === 401 || response.status === 403) {
            window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des catégories');
        }
        
        const categories = await response.json();
        
        const categoriesBar = document.querySelector('.categories-bar');
        categoriesBar.innerHTML = ''; // Vider la barre de catégories
        
        // S'assurer que le bouton "Tous" est toujours présent
        const allButton = document.createElement('button');
        allButton.className = 'category-btn active';
        allButton.setAttribute('data-category', 'all');
        allButton.textContent = 'Tous';
        categoriesBar.appendChild(allButton);
        
        // Ajouter les autres catégories
        categories.forEach(category => {
            if (category.active) {
                const button = document.createElement('button');
                button.className = 'category-btn';
                button.setAttribute('data-category', category.name);
                button.textContent = category.name;
                categoriesBar.appendChild(button);
            }
        });

        // Gérer les clics sur les boutons de catégorie
        categoriesBar.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                // Retirer la classe active de tous les boutons
                document.querySelectorAll('.category-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                
                // Ajouter la classe active au bouton cliqué
                e.target.classList.add('active');
                
                // Charger les produits de la catégorie
                const category = e.target.getAttribute('data-category');
                loadProducts(category);
            }
        });
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

async function loadProducts(category = 'all') {
    try {
        const response = await fetch('/api/products');
        
        // Vérifier si l'utilisateur a été déconnecté
        if (response.status === 401 || response.status === 403) {
            window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des produits');
        }
        
        products = await response.json(); // Stocker dans la variable globale
        
        const container = document.getElementById('products-container');
        container.innerHTML = '';
        
        // Filtrer les produits selon la catégorie
        const filteredProducts = category === 'all' 
            ? products 
            : products.filter(p => p.category === category);

        // Afficher les produits filtrés
        filteredProducts.forEach(product => {
            const tile = document.createElement('div');
            tile.className = `product-tile ${product.stock <= 0 ? 'out-of-stock' : ''}`;
            tile.innerHTML = `
                <div class="product-image">
                    <img src="${product.image}" alt="${product.name}">
                </div>
                <div class="product-name">${product.name}</div>
                <div class="product-price">${product.price.toFixed(2)}$</div>
                <div class="product-stock">${product.stock} en stock</div>
            `;
            if (product.stock > 0) {
                tile.onclick = () => addToCart(product._id);
            }
            container.appendChild(tile);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
    }
}

// Mise à jour de l'interface
function updateCategoriesBar() {
    const categoriesBar = document.querySelector('.categories-bar');
    products.forEach(product => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.setAttribute('data-category', product.category);
        button.textContent = product.category;
        button.onclick = () => filterProducts(product.category);
        categoriesBar.appendChild(button);
    });
}

function displayProducts(category) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    const filteredProducts = category === 'all' 
        ? products 
        : products.filter(p => p.category === category);

    filteredProducts.forEach(product => {
        const tile = document.createElement('div');
        tile.className = `product-tile ${product.stock <= 0 ? 'out-of-stock' : ''}`;
        tile.innerHTML = `
            <div class="product-image">
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price.toFixed(2)}$</div>
            <div class="product-stock">${product.stock} en stock</div>
        `;
        if (product.stock > 0) {
            tile.onclick = () => addToCart(product._id);
        }
        container.appendChild(tile);
    });
}

// Fonction pour calculer le prix en fonction de la quantité
function calculatePrice(product, quantity) {
    if (!product.quantityPrices || product.quantityPrices.length === 0) {
        return product.price;
    }

    // Trouver le prix applicable pour cette quantité
    const applicablePrice = product.quantityPrices.find(qp => quantity >= qp.quantity);
    return applicablePrice ? applicablePrice.price : product.price;
}

// Mettre à jour la fonction d'ajout au panier
function addToCart(productId) {
    const product = products.find(p => p._id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.product._id === productId);
    if (existingItem) {
        existingItem.quantity++;
        // Recalculer le prix unitaire en fonction de la nouvelle quantité
        existingItem.price = calculatePrice(product, existingItem.quantity);
    } else {
        cart.push({
            product: product,
            quantity: 1,
            price: product.price,
            cost: product.costPrice
        });
    }

    updateCart();
}

// Mettre à jour la fonction de mise à jour de la quantité
function updateQuantity(index, newQuantity) {
    if (newQuantity < 1) return;
    
    const item = cart[index];
    item.quantity = newQuantity;
    // Recalculer le prix unitaire
    item.price = calculatePrice(item.product, newQuantity);
    
    updateCart();
}

// Mettre à jour la fonction d'affichage du panier
function updateCart() {
    const cartItems = document.getElementById('cart-items');
    cartItems.innerHTML = '';
    
    let subtotal = 0; // Initialiser le sous-total
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemSubtotal = item.price * item.quantity;
        subtotal += itemSubtotal;
        total += itemSubtotal;

        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div class="mini-image">
                <img src="${item.product.image || '/images/default-product.png'}" alt="">
            </div>
            <div class="cart-item-details">
                <span class="item-name">${item.product.name}</span>
                <div class="price-line">
                    <span class="item-price">${item.price.toFixed(2)}$</span>
                    <span class="item-subtotal">${itemSubtotal.toFixed(2)}$</span>
                </div>
                <div class="quantity-controls">
                    <button onclick="updateQuantity(${index}, ${item.quantity - 1})">
                        <i class="fas fa-minus"></i>
                    </button>
                    <span>${item.quantity}</span>
                    <button onclick="updateQuantity(${index}, ${item.quantity + 1})">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
            <div class="cart-item-actions">
                <button class="remove-item" onclick="removeFromCart(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        cartItems.appendChild(itemElement);
    });

    // Mettre à jour le sous-total et le total
    document.getElementById('subtotal').textContent = subtotal.toFixed(2) + '$';
    document.getElementById('total').textContent = total.toFixed(2) + '$';
    
    // Mettre à jour le changement si un montant a été entré
    calculateChange();
}

// Gestion du panier
function removeFromCart(index) {
    if (confirm('Voulez-vous vraiment supprimer cet article du panier ?')) {
        cart.splice(index, 1);
        updateCart();
    }
}

// Gestion des paiements
function setupEventListeners() {
    document.getElementById('clear-cart').onclick = clearCart;
    document.getElementById('amount-received').oninput = calculateChange;
    document.getElementById('complete-sale').onclick = completeSale;
    document.getElementById('apply-coupon').onclick = async () => {
        const code = document.getElementById('coupon-code').value.trim();
        const couponInfo = document.getElementById('coupon-info');
        
        if (!code) {
            couponInfo.className = 'coupon-info error';
            couponInfo.textContent = 'Veuillez entrer un code';
            return;
        }
        
        try {
            const response = await fetch(`/api/coupons/verify/${code}`);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message);
            }
            
            currentCoupon = await response.json();
            couponInfo.className = 'coupon-info success';
            couponInfo.textContent = `Coupon appliqué: ${currentCoupon.type === 'percentage' ? 
                currentCoupon.value + '% de réduction' : 
                'Réduction de ' + currentCoupon.value.toFixed(2) + '$'}`;
            
            updateCart();
        } catch (error) {
            currentCoupon = null;
            couponInfo.className = 'coupon-info error';
            couponInfo.textContent = error.message || 'Coupon invalide';
            updateCart();
        }
    };

    // Gestionnaire de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                try {
                    const response = await fetch('/auth/logout');
                    if (response.ok || response.redirected) {
                        window.location.href = '/login?returnTo=/';
                    }
                } catch (error) {
                    console.error('Erreur lors de la déconnexion:', error);
                    // Forcer la redirection même en cas d'erreur
                    window.location.href = '/login?returnTo=/';
                }
            }
        });
    }
}

function clearCart() {
    if (confirm('Voulez-vous vraiment vider le panier ?')) {
        cart = [];
        updateCart();
    }
}

function calculateChange() {
    // Utiliser le total qui inclut déjà les réductions
    const amountReceived = parseFloat(document.getElementById('amount-received').value) || 0;
    const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
    const change = amountReceived - total;
    
    document.getElementById('change-amount').textContent = 
        (change >= 0 ? change : 0).toFixed(2) + '$';
    
    // Activer le bouton seulement si un montant valide a été reçu
    const completeButton = document.getElementById('complete-sale');
    if (document.getElementById('amount-received').value !== '' && amountReceived >= total) {
        completeButton.disabled = false;
    } else {
        completeButton.disabled = true;
    }
}

// Ajouter un écouteur d'événements pour le champ de montant reçu
document.getElementById('amount-received').addEventListener('input', calculateChange);

async function completeSale() {
    try {
        const total = parseFloat(document.getElementById('total').textContent.replace('$', ''));
        const subtotal = parseFloat(document.getElementById('subtotal').textContent.replace('$', ''));
        const amountReceived = parseFloat(document.getElementById('amount-received').value);
        
        if (amountReceived < total) {
            alert('Montant insuffisant');
            return;
        }

        // Préparer les items avec tous les champs requis
        const items = cart.map(item => ({
            product: item.product._id,
            quantity: item.quantity,
            price: item.product.price, // Prix original du produit
            cost: item.product.costPrice, // Prix coûtant du produit
            discount: item.discount || 0,
            finalPrice: item.price // Prix après réduction
        }));

        // Calculer le profit total
        const profit = items.reduce((sum, item) => {
            const revenue = item.finalPrice * item.quantity;
            const cost = item.cost * item.quantity;
            return sum + (revenue - cost);
        }, 0);

        const saleData = {
            items: items,
            total: total,
            originalTotal: subtotal,
            discount: subtotal - total,
            profit: profit,
            paymentMethod: 'cash',
            amountReceived: amountReceived,
            coupon: currentCoupon ? currentCoupon._id : null
        };

        const response = await fetch('/api/sales', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(saleData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la vente');
        }

        // Si la vente est réussie
        const change = amountReceived - total;
        
        // Créer et afficher la notification stylisée
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div class="sale-notification-overlay"></div>
            <div class="sale-notification">
                <div class="sale-notification-header">
                    <i class="fas fa-check-circle"></i>
                    <h3>Vente complétée!</h3>
                </div>
                <div class="sale-notification-content">
                    <p>Monnaie à rendre:</p>
                    <div class="sale-notification-amount">${change.toFixed(2)}$</div>
                </div>
                <button class="sale-notification-button">OK</button>
            </div>
        `;
        document.body.appendChild(notification);

        // Gérer la fermeture de la notification
        const closeNotification = () => {
            notification.remove();
            // Réinitialiser le panier et les champs
            cart = [];
            currentCoupon = null;
            document.getElementById('amount-received').value = '';
            document.getElementById('change-amount').textContent = '0.00$';
            document.getElementById('coupon-info').textContent = '';
            updateCart();
            loadProducts();
        };

        notification.querySelector('.sale-notification-button').onclick = closeNotification;
        notification.querySelector('.sale-notification-overlay').onclick = closeNotification;

    } catch (error) {
        console.error('Erreur détaillée:', error);
        
        // Notification d'erreur stylisée
        const errorNotification = document.createElement('div');
        errorNotification.innerHTML = `
            <div class="sale-notification-overlay"></div>
            <div class="sale-notification error">
                <div class="sale-notification-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Erreur</h3>
                </div>
                <div class="sale-notification-content">
                    <p>${error.message || 'Erreur lors de la vente'}</p>
                </div>
                <button class="sale-notification-button">Fermer</button>
            </div>
        `;
        document.body.appendChild(errorNotification);

        const closeError = () => errorNotification.remove();
        errorNotification.querySelector('.sale-notification-button').onclick = closeError;
        errorNotification.querySelector('.sale-notification-overlay').onclick = closeError;
    }
}

function filterProducts(category) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    displayProducts(category);
}

// Ajouter la fonction pour charger les coupons disponibles
async function loadAvailableCoupons() {
    try {
        const response = await fetch('/api/coupons/available');
        
        // Vérifier si l'utilisateur a été déconnecté
        if (response.status === 401 || response.status === 403) {
            window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erreur lors du chargement des coupons');
        }
        
        const coupons = await response.json();
        
        const couponsContainer = document.getElementById('available-coupons');
        couponsContainer.innerHTML = '';
        
        coupons.forEach(coupon => {
            const button = document.createElement('button');
            button.className = 'coupon-button';
            button.innerHTML = `
                <i class="fas fa-ticket-alt"></i>
                <span class="coupon-code">${coupon.code}</span>
                <span class="coupon-value">(${coupon.type === 'percentage' ? coupon.value + '%' : coupon.value + '$'})</span>
            `;
            button.onclick = () => applyCoupon(coupon);
            couponsContainer.appendChild(button);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des coupons:', error);
    }
}

// Modifier la fonction d'application du coupon
async function applyCoupon(couponOrCode) {
    try {
        let coupon;
        
        // Si on reçoit un objet coupon directement (clic sur bouton)
        if (typeof couponOrCode === 'object') {
            coupon = couponOrCode;
        } else {
            // Si on reçoit un code (saisie manuelle)
            const response = await fetch(`/api/coupons/verify/${couponOrCode}`);
            if (!response.ok) {
                throw new Error('Coupon invalide');
            }
            coupon = await response.json();
        }

        // Retirer la classe active de tous les boutons
        document.querySelectorAll('.coupon-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Si on clique sur le coupon déjà actif, on le désactive
        if (currentCoupon && currentCoupon._id === coupon._id) {
            currentCoupon = null;
            // Réinitialiser les prix originaux
            cart.forEach(item => {
                item.discount = 0;
                item.price = item.product.price; // Utiliser le prix original du produit
            });
            document.getElementById('coupon-info').textContent = '';
            document.getElementById('discount-amount').style.display = 'none';
            updateCart();
            return;
        }

        // Calculer le rabais seulement pour les produits applicables
        let totalDiscount = 0;
        cart.forEach(item => {
            // Réinitialiser d'abord le prix à sa valeur originale
            item.price = item.product.price;
            
            let isApplicable = false;

            switch (coupon.applicationType) {
                case 'all':
                    isApplicable = true;
                    break;
                case 'product':
                    isApplicable = coupon.applicableProducts.includes(item.product._id);
                    break;
                case 'category':
                    isApplicable = coupon.applicableCategories.includes(item.product.category);
                    break;
            }

            if (isApplicable) {
                const itemTotal = item.quantity * item.price;
                const itemDiscount = coupon.type === 'percentage' 
                    ? (itemTotal * coupon.value / 100)
                    : (coupon.value / getApplicableItemsCount(coupon));
                
                item.discount = itemDiscount;
                item.price = item.price - (itemDiscount / item.quantity);
            } else {
                item.discount = 0;
            }

            totalDiscount += item.discount;
        });

        currentCoupon = coupon;
        
        // Activer le bouton du coupon
        const button = Array.from(document.querySelectorAll('.coupon-button'))
            .find(btn => btn.querySelector('.coupon-code').textContent === coupon.code);
        if (button) button.classList.add('active');

        document.getElementById('coupon-info').className = 'coupon-info success';
        document.getElementById('coupon-info').textContent = `Coupon appliqué: ${coupon.type === 'percentage' ? 
            coupon.value + '% de réduction' : 
            'Réduction de ' + coupon.value.toFixed(2) + '$'}`;
        
        updateCart();
    } catch (error) {
        console.error('Erreur lors de l\'application du coupon:', error);
        document.getElementById('coupon-info').className = 'coupon-info error';
        document.getElementById('coupon-info').textContent = error.message || 'Erreur lors de l\'application du coupon';
        currentCoupon = null;
        
        // Réinitialiser les prix en cas d'erreur
        cart.forEach(item => {
            item.discount = 0;
            item.price = item.product.price;
        });
        updateCart();
    }
}

function getApplicableItemsCount(coupon) {
    return cart.filter(item => {
        switch (coupon.applicationType) {
            case 'all':
                return true;
            case 'product':
                return coupon.applicableProducts.includes(item.product._id);
            case 'category':
                return coupon.applicableCategories.includes(item.product.category);
            default:
                return false;
        }
    }).reduce((total, item) => total + item.quantity, 0);
}

// Mettre à jour la fonction d'affichage des prix par quantité
function showQuantityPrices(product) {
    if (!product.quantityPrices || product.quantityPrices.length === 0) return '';

    return `
        <div class="quantity-prices-info">
            <small>Prix par quantité :</small>
            ${product.quantityPrices.map(qp => 
                `<div class="quantity-price-row">
                    ${qp.quantity}+ unités : ${qp.price.toFixed(3)}$ / unité
                </div>`
            ).join('')}
        </div>
    `;
}

// Modifier la fonction qui affiche les produits
function displayProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    productsGrid.innerHTML = '';
    
    products.forEach(product => {
        const productElement = document.createElement('div');
        productElement.className = 'product-card';
        productElement.innerHTML = `
            <img src="${product.image || '/images/default-product.png'}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p class="price">${product.price.toFixed(2)}$</p>
            ${showQuantityPrices(product)}
            <button onclick="addToCart('${product._id}')" ${product.stock <= 0 ? 'disabled' : ''}>
                <i class="fas fa-plus"></i> Ajouter
            </button>
        `;
        productsGrid.appendChild(productElement);
    });
} 