let cart = [];
let products = [];
let currentCoupon = null;
let subtotal = 0;
let ticketConfig = { basePrice: 0.50, quantityOffers: [] }; // Configuration des tickets

// Gestion du timeout de session (30 minutes)
let inactivityTimer = null;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes en millisecondes
const WARNING_TIME = 5 * 60 * 1000; // Avertir 5 minutes avant la déconnexion
let warningShown = false;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier l'authentification
    await checkAuth();
    
    // Initialiser le système de timeout de session
    initSessionTimeout();
    
    await Promise.all([
        setupCategories(),
        loadProducts(),
        loadTicketConfig()
    ]);
    setupEventListeners();
    initCouponModal();
});

// Initialiser le système de timeout de session
function initSessionTimeout() {
    // Réinitialiser le timer à chaque interaction utilisateur
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, true);
    });
    
    // Démarrer le timer
    resetInactivityTimer();
}

// Réinitialiser le timer d'inactivité
function resetInactivityTimer() {
    // Réinitialiser l'avertissement
    warningShown = false;
    
    // Effacer le timer existant
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    // Afficher un avertissement 5 minutes avant la déconnexion
    const warningTimer = setTimeout(() => {
        showInactivityWarning();
    }, SESSION_TIMEOUT - WARNING_TIME);
    
    // Déconnecter après 30 minutes d'inactivité
    inactivityTimer = setTimeout(() => {
        handleSessionTimeout();
    }, SESSION_TIMEOUT);
}

// Afficher un avertissement avant la déconnexion
function showInactivityWarning() {
    if (warningShown) return;
    warningShown = true;
    
    const warning = confirm(
        'Vous serez déconnecté dans 5 minutes en raison de l\'inactivité.\n\n' +
        'Cliquez sur OK pour rester connecté.'
    );
    
    if (warning) {
        // L'utilisateur a cliqué OK, réinitialiser le timer
        resetInactivityTimer();
    }
}

// Gérer le timeout de session
async function handleSessionTimeout() {
    console.log('Session expirée - déconnexion automatique');
    
    // Afficher un message
    alert('Votre session a expiré en raison de l\'inactivité. Vous allez être déconnecté.');
    
    // Déconnecter l'utilisateur
    try {
        await fetch('/auth/logout', {
            method: 'GET',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json'
            }
        });
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
    }
    
    // Rediriger vers la page de login
    window.location.href = '/login?returnTo=' + encodeURIComponent(window.location.pathname);
}

// Charger la configuration des tickets
async function loadTicketConfig() {
    try {
        const response = await fetch('/api/tickets/config');
        if (response.ok) {
            ticketConfig = await response.json();
            console.log('Configuration des tickets chargée:', ticketConfig);
            // Afficher les offres disponibles dans le modal
            displayAvailableOffers();
        } else {
            console.error('Erreur lors du chargement de la configuration:', response.status);
        }
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration des tickets:', error);
    }
}

// Afficher les offres disponibles comme boutons sélectionnables
function displayAvailableOffers() {
    const offersSelection = document.getElementById('offers-selection');
    if (!offersSelection) {
        console.warn('Element offers-selection non trouvé');
        return;
    }
    
    console.log('Affichage des offres disponibles');
    offersSelection.innerHTML = '';
    
    // Si aucune offre n'est configurée, utiliser le prix de base
    if (!ticketConfig.quantityOffers || ticketConfig.quantityOffers.length === 0) {
        console.log('Aucune offre configurée, utilisation du prix de base');
        const basePrice = ticketConfig.basePrice || 0.50;
        const baseOffer = document.createElement('button');
        baseOffer.type = 'button';
        baseOffer.className = 'offer-button';
        baseOffer.dataset.quantity = '1';
        baseOffer.dataset.price = basePrice;
        baseOffer.innerHTML = `
            <div class="offer-button-content">
                <div class="offer-quantity">1 billet</div>
                <div class="offer-price">${basePrice.toFixed(2)}$</div>
            </div>
        `;
        baseOffer.onclick = () => {
            console.log('Clic sur offre de base:', { quantity: 1, price: basePrice });
            selectOffer(1, basePrice, baseOffer);
        };
        offersSelection.appendChild(baseOffer);
        return;
    }
    
    // Trier les offres par quantité croissante
    const sortedOffers = [...ticketConfig.quantityOffers].sort((a, b) => a.quantity - b.quantity);
    console.log('Offres triées:', sortedOffers);
    
    sortedOffers.forEach(offer => {
        const offerButton = document.createElement('button');
        offerButton.type = 'button';
        offerButton.className = 'offer-button';
        offerButton.dataset.quantity = offer.quantity;
        offerButton.dataset.price = offer.price;
        offerButton.innerHTML = `
            <div class="offer-button-content">
                <div class="offer-quantity">${offer.quantity} billet(s)</div>
                <div class="offer-price">${offer.price.toFixed(2)}$</div>
                ${offer.quantity > 1 && ticketConfig.basePrice ? `<div class="offer-savings">${((ticketConfig.basePrice * offer.quantity - offer.price) / (ticketConfig.basePrice * offer.quantity) * 100).toFixed(0)}% d'économie</div>` : ''}
            </div>
        `;
        offerButton.onclick = () => {
            console.log('Clic sur offre:', { quantity: offer.quantity, price: offer.price });
            selectOffer(offer.quantity, offer.price, offerButton);
        };
        offersSelection.appendChild(offerButton);
    });
}

// Sélectionner une offre
function selectOffer(quantity, price, buttonElement) {
    console.log('Sélection d\'une offre:', { quantity, price });
    
    // Retirer la sélection de tous les boutons
    document.querySelectorAll('.offer-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Sélectionner le bouton cliqué
    buttonElement.classList.add('selected');
    
    // Mettre à jour les champs cachés
    const quantityInput = document.getElementById('ticket-quantity');
    const priceInput = document.getElementById('ticket-price');
    
    if (!quantityInput || !priceInput) {
        console.error('Champs cachés non trouvés');
        return;
    }
    
    quantityInput.value = quantity;
    priceInput.value = price;
    
    console.log('Champs mis à jour:', { quantity: quantityInput.value, price: priceInput.value });
    
    // Mettre à jour l'affichage du total
    const totalDisplay = document.getElementById('ticket-total');
    if (totalDisplay) {
        totalDisplay.textContent = price.toFixed(2) + '$';
    }
    
    // Activer le bouton "Ajouter au panier"
    const addButton = document.getElementById('add-tickets-btn');
    if (addButton) {
        addButton.disabled = false;
        console.log('Bouton "Ajouter au panier" activé');
    } else {
        console.warn('Bouton "Ajouter au panier" non trouvé');
    }
    
    // Afficher l'info de l'offre
    const offerInfo = document.getElementById('ticket-offer-info');
    if (quantity > 1 && ticketConfig.basePrice) {
        const savings = ((ticketConfig.basePrice * quantity - price) / (ticketConfig.basePrice * quantity) * 100).toFixed(0);
        if (offerInfo) {
            offerInfo.style.display = 'block';
            offerInfo.className = 'ticket-offer-info success';
            offerInfo.innerHTML = `
                <i class="fas fa-tag"></i>
                <strong>Offre sélectionnée:</strong> ${quantity} billet(s) pour ${price.toFixed(2)}$ (${savings}% d'économie)
            `;
        }
    } else {
        if (offerInfo) {
            offerInfo.style.display = 'none';
        }
    }
}

// Calculer le prix d'un ticket en fonction de la quantité (fonction non utilisée maintenant, mais gardée pour compatibilité)
function calculateTicketPrice(quantity) {
    if (!ticketConfig.quantityOffers || ticketConfig.quantityOffers.length === 0) {
        return quantity * (ticketConfig.basePrice || 0.50);
    }
    
    // Chercher une offre exacte correspondant à la quantité
    const exactOffer = ticketConfig.quantityOffers.find(o => o.quantity === quantity);
    if (exactOffer) {
        return exactOffer.price;
    }
    
    // Si quantité = 1 et aucune offre pour 1, utiliser le prix de base
    if (quantity === 1) {
        return ticketConfig.basePrice || 0.50;
    }
    
    // Si aucune offre exacte, utiliser le prix de base
    return quantity * (ticketConfig.basePrice || 0.50);
}

// Vérifier l'authentification et masquer/afficher le lien admin
let currentUser = null;

// Fonction globale pour gérer la déconnexion (accessible depuis onclick)
window.handleLogout = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log('handleLogout appelé');
    
    if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
        console.log('Confirmation acceptée, déconnexion en cours...');
        try {
            const response = await fetch('/auth/logout', {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                },
                credentials: 'same-origin'
            });
            
            console.log('Réponse de déconnexion:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Données de réponse:', data);
                if (data.success) {
                    console.log('Déconnexion réussie, redirection...');
                    window.location.href = '/login?returnTo=/';
                } else {
                    console.log('Déconnexion échouée, redirection forcée...');
                    window.location.href = '/login?returnTo=/';
                }
            } else {
                console.log('Erreur HTTP, redirection forcée...');
                window.location.href = '/login?returnTo=/';
            }
        } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
            window.location.href = '/login?returnTo=/';
        }
    } else {
        console.log('Déconnexion annulée par l\'utilisateur');
    }
};

async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        if (!response.ok) {
            // Rediriger vers la page de login avec returnTo
            window.location.href = `/login?returnTo=${encodeURIComponent('/')}`;
            return;
        }
        
        const data = await response.json();
        currentUser = data.user;
        
        // Masquer le lien admin si l'utilisateur n'est pas admin
        const adminLink = document.querySelector('.admin-link');
        if (adminLink) {
            if (currentUser && currentUser.role === 'admin') {
                adminLink.style.display = 'flex';
            } else {
                adminLink.style.display = 'none';
            }
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
        
        // Sauvegarder les boutons spéciaux s'ils existent
        const ticketSaleBtn = categoriesBar.querySelector('.ticket-sale-btn');
        const couponBtn = categoriesBar.querySelector('.coupon-btn');
        const adminBtn = categoriesBar.querySelector('.admin-btn');
        
        // Vider la barre de catégories (mais préserver les boutons spéciaux)
        const existingButtons = categoriesBar.querySelectorAll('.category-btn');
        existingButtons.forEach(btn => btn.remove());
        
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
        
        // Réajouter le bouton "Moitié-Moitié" s'il existait
        if (ticketSaleBtn) {
            categoriesBar.appendChild(ticketSaleBtn);
        }
        
        // Réajouter le bouton "Coupon" s'il existait
        if (couponBtn) {
            categoriesBar.appendChild(couponBtn);
        }
        
        // Réajouter le bouton "Admin" s'il existait
        if (adminBtn) {
            categoriesBar.appendChild(adminBtn);
        }

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
                    <img src="${product.imageUrl || product.image || ''}" alt="${product.name}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'150\' height=\'150\'%3E%3Crect fill=\'%23ddd\' width=\'150\' height=\'150\'/%3E%3Ctext fill=\'%23999\' font-family=\'sans-serif\' font-size=\'14\' dy=\'10.5\' font-weight=\'bold\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\'%3EPas d\'image%3C/text%3E%3C/svg%3E';">
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
                <img src="${product.imageUrl || product.image}" alt="${product.name}" onerror="this.src='/uploads/products/default.jpg'">
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

    const existingItem = cart.find(item => item.product && item.product._id === productId);
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

// Ajouter des coupons au panier
function addTicketsToCart(email, quantity, price) {
    console.log('Ajout de tickets au panier:', { email, quantity, price });
    
    const ticketItem = {
        isTicket: true,
        ticketEmail: email,
        ticketQuantity: quantity,
        product: null, // Pas de produit pour les tickets
        quantity: 1, // 1 item dans le panier (mais représente X coupons)
        price: price, // Utiliser le prix de l'offre sélectionnée
        cost: 0, // Pas de coût pour les tickets
        name: `${quantity} coupon(s) - ${email}`
    };
    
    console.log('Item à ajouter:', ticketItem);
    cart.push(ticketItem);
    console.log('Panier après ajout:', cart);
    
    updateCart();
    closeTicketSaleModal();
}

// Mettre à jour la fonction de mise à jour de la quantité
function updateQuantity(index, newQuantity) {
    if (newQuantity < 1) return;
    
    const item = cart[index];
    
    // Ne pas permettre de modifier la quantité des tickets
    if (item.isTicket) {
        return;
    }
    
    item.quantity = newQuantity;
    // Recalculer le prix unitaire
    item.price = calculatePrice(item.product, newQuantity);
    
    updateCart();
}

// Mettre à jour la fonction d'affichage du panier
function updateCart() {
    const cartItems = document.getElementById('cart-items');
    if (!cartItems) {
        console.error('Element cart-items non trouvé');
        return;
    }
    
    cartItems.innerHTML = '';
    
    let subtotal = 0; // Initialiser le sous-total
    let total = 0;
    
    console.log('Mise à jour du panier, nombre d\'items:', cart.length);
    
    cart.forEach((item, index) => {
        console.log('Traitement item', index, ':', item);
        
        // Pour les tickets, le prix est déjà le total
        // Pour les produits, multiplier par la quantité
        const itemSubtotal = item.isTicket ? item.price : (item.price * item.quantity);
        subtotal += itemSubtotal;
        total += itemSubtotal;

        // Gérer les tickets différemment
        if (item.isTicket) {
            console.log('Affichage d\'un ticket:', item);
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item ticket-item';
            
            // Vérifier que les propriétés existent
            const ticketQuantity = item.ticketQuantity || 1;
            const ticketEmail = item.ticketEmail || 'Email non défini';
            const ticketPrice = item.price || 0;
            
            itemElement.innerHTML = `
                <div class="mini-image">
                    <i class="fas fa-ticket-alt" style="font-size: 2rem; color: var(--primary-color);"></i>
                </div>
                <div class="cart-item-details">
                    <span class="item-name">${ticketQuantity} coupon(s)</span>
                    <div class="item-email" style="font-size: 0.85rem; color: var(--text-light); margin-top: 4px;">${ticketEmail}</div>
                    <div class="price-line">
                        <span class="item-price">${ticketPrice.toFixed(2)}$</span>
                        <span class="item-subtotal">${itemSubtotal.toFixed(2)}$</span>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="remove-item" onclick="removeFromCart(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItems.appendChild(itemElement);
        } else {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <div class="mini-image">
                    <img src="${(item.product.imageUrl || item.product.image || '/images/default-product.png')}" alt="" onerror="this.src='/images/default-product.png'">
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
        }
    });

    // Calculer la réduction totale du coupon
    let totalDiscount = 0;
    cart.forEach(item => {
        if (item.discount) {
            totalDiscount += item.discount;
        }
    });
    
    // Mettre à jour le sous-total et le total
    document.getElementById('subtotal').textContent = subtotal.toFixed(2) + '$';
    
    // Afficher la réduction si un coupon est appliqué
    const discountAmountDiv = document.getElementById('discount-amount');
    if (currentCoupon && totalDiscount > 0) {
        discountAmountDiv.style.display = 'flex';
        document.getElementById('discount').textContent = '-' + totalDiscount.toFixed(2) + '$';
        total = subtotal - totalDiscount;
    } else {
        discountAmountDiv.style.display = 'none';
        total = subtotal;
    }
    
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
    const clearCartBtn = document.getElementById('clear-cart');
    const amountReceivedInput = document.getElementById('amount-received');
    const completeSaleBtn = document.getElementById('complete-sale');
    
    if (clearCartBtn) {
        clearCartBtn.onclick = clearCart;
    }
    
    if (amountReceivedInput) {
        amountReceivedInput.oninput = calculateChange;
    }
    
    if (completeSaleBtn) {
        completeSaleBtn.onclick = completeSale;
    }

    // Gestionnaire de déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    console.log('Bouton de déconnexion trouvé:', logoutBtn);
    
    if (logoutBtn) {
        console.log('Attachement de l\'événement de déconnexion');
        logoutBtn.onclick = async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Clic sur le bouton de déconnexion détecté');
            
            if (confirm('Voulez-vous vraiment vous déconnecter ?')) {
                console.log('Confirmation acceptée, déconnexion en cours...');
                try {
                    const response = await fetch('/auth/logout', {
                        method: 'GET',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json'
                        },
                        credentials: 'same-origin'
                    });
                    
                    console.log('Réponse de déconnexion:', response.status);
                    
                    if (response.ok) {
                        const data = await response.json();
                        console.log('Données de réponse:', data);
                        if (data.success) {
                            console.log('Déconnexion réussie, redirection...');
                            window.location.href = '/login?returnTo=/';
                        } else {
                            console.log('Déconnexion échouée, redirection forcée...');
                            window.location.href = '/login?returnTo=/';
                        }
                    } else {
                        console.log('Erreur HTTP, redirection forcée...');
                        window.location.href = '/login?returnTo=/';
                    }
                } catch (error) {
                    console.error('Erreur lors de la déconnexion:', error);
                    window.location.href = '/login?returnTo=/';
                }
            } else {
                console.log('Déconnexion annulée par l\'utilisateur');
            }
        };
    } else {
        console.error('ERREUR: Bouton de déconnexion non trouvé dans le DOM');
    }
    
    // Masquer le lien admin si l'utilisateur n'est pas admin (double vérification)
    const adminLink = document.querySelector('.admin-link');
    if (adminLink && currentUser && currentUser.role !== 'admin') {
        adminLink.style.display = 'none';
    }
    
    // Gérer le modal de vente de tickets
    setupTicketSaleModal();
}

// ============================================
// FONCTIONS POUR LA VENTE DE TICKETS
// ============================================

function setupTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    const form = document.getElementById('ticket-sale-form');
    const closeBtn = modal?.querySelector('.close');
    
    // Gérer la soumission du formulaire
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const emailInput = document.getElementById('ticket-email');
            const quantityInput = document.getElementById('ticket-quantity');
            const priceInput = document.getElementById('ticket-price');
            
            if (!emailInput || !quantityInput || !priceInput) {
                console.error('Champs du formulaire non trouvés');
                alert('Erreur: champs du formulaire non trouvés');
                return;
            }
            
            const email = emailInput.value.trim();
            const quantity = parseInt(quantityInput.value);
            const price = parseFloat(priceInput.value);
            
            console.log('Valeurs du formulaire:', { email, quantity, price });
            
            if (!email || !email.includes('@')) {
                alert('Veuillez entrer une adresse email valide');
                return;
            }
            
            if (!quantity || quantity < 1 || isNaN(quantity)) {
                alert('Veuillez sélectionner une offre');
                return;
            }
            
            if (!price || price <= 0 || isNaN(price)) {
                alert('Prix invalide. Veuillez sélectionner une offre.');
                return;
            }
            
            // Ajouter au panier avec le prix de l'offre
            console.log('Soumission du formulaire:', { email, quantity, price });
            addTicketsToCart(email, quantity, price);
        });
    }
    
    // Fermer le modal avec le bouton X
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTicketSaleModal);
    }
    
    // Fermer le modal en cliquant en dehors
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeTicketSaleModal();
            }
        });
    }
}

function openTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Réinitialiser le formulaire
        const form = document.getElementById('ticket-sale-form');
        if (form) {
            form.reset();
            const quantityInput = document.getElementById('ticket-quantity');
            const priceInput = document.getElementById('ticket-price');
            const totalDisplay = document.getElementById('ticket-total');
            const offerInfo = document.getElementById('ticket-offer-info');
            
            if (quantityInput) quantityInput.value = '';
            if (priceInput) priceInput.value = '';
            if (totalDisplay) totalDisplay.textContent = '0.00$';
            if (offerInfo) offerInfo.style.display = 'none';
            
            // Désactiver le bouton "Ajouter au panier"
            const addButton = document.getElementById('add-tickets-btn');
            if (addButton) {
                addButton.disabled = true;
            }
            
            // Désélectionner tous les boutons
            document.querySelectorAll('.offer-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // S'assurer que les offres sont affichées
            displayAvailableOffers();
        }
    }
}

function closeTicketSaleModal() {
    const modal = document.getElementById('ticket-sale-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Fonctions pour la modal coupon
function openCouponModal() {
    const modal = document.getElementById('coupon-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Réinitialiser le formulaire
        const form = document.getElementById('coupon-form');
        if (form) {
            form.reset();
        }
        const couponInfo = document.getElementById('coupon-modal-info');
        if (couponInfo) {
            couponInfo.textContent = '';
            couponInfo.className = 'coupon-info';
        }
        // Focus sur l'input
        const input = document.getElementById('coupon-code-input');
        if (input) {
            input.focus();
        }
    }
}

function closeCouponModal() {
    const modal = document.getElementById('coupon-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function applyCouponFromModal() {
    const codeInput = document.getElementById('coupon-code-input');
    const couponInfo = document.getElementById('coupon-modal-info');
    
    if (!codeInput || !couponInfo) {
        console.error('Éléments de la modal coupon non trouvés');
        return;
    }
    
    const code = codeInput.value.trim();
    
    if (!code) {
        couponInfo.className = 'coupon-info error';
        couponInfo.textContent = 'Veuillez entrer un code de coupon';
        return;
    }
    
    try {
        await applyCoupon(code);
        // Afficher un message de succès dans la modal
        couponInfo.className = 'coupon-info success';
        couponInfo.textContent = `Coupon "${code}" appliqué avec succès !`;
        // Fermer la modal après un court délai
        setTimeout(() => {
            closeCouponModal();
        }, 1500);
    } catch (error) {
        couponInfo.className = 'coupon-info error';
        couponInfo.textContent = error.message || 'Erreur lors de l\'application du coupon';
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

        // Séparer les produits normaux des tickets
        const productItems = cart.filter(item => !item.isTicket);
        const ticketItems = cart.filter(item => item.isTicket);

        // Traiter les ventes de produits normaux
        if (productItems.length > 0) {
            const items = productItems.map(item => ({
                product: item.product._id,
                quantity: item.quantity,
                price: item.product.price,
                cost: item.product.costPrice,
                discount: item.discount || 0,
                finalPrice: item.price
            }));

            const profit = items.reduce((sum, item) => {
                const revenue = item.finalPrice * item.quantity;
                const cost = item.cost * item.quantity;
                return sum + (revenue - cost);
            }, 0);

            const productTotal = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const saleData = {
                items: items,
                total: productTotal,
                originalTotal: productTotal,
                discount: 0,
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
        }

        // Traiter les ventes de tickets
        for (const ticketItem of ticketItems) {
            try {
                const response = await fetch('/api/tickets/purchase', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: ticketItem.ticketEmail,
                        quantity: ticketItem.ticketQuantity,
                        totalAmount: ticketItem.price,
                        paymentMethod: 'cash'
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Erreur lors de la vente de tickets:', errorData);
                    // Continuer même en cas d'erreur pour les autres tickets
                }
            } catch (error) {
                console.error('Erreur lors de la vente de tickets:', error);
            }
        }

        // Si la vente est réussie
        const change = amountReceived - total;
        
        // Créer et afficher la notification stylisée
        const notification = document.createElement('div');
        let notificationContent = `
            <div class="sale-notification-overlay"></div>
            <div class="sale-notification">
                <div class="sale-notification-header">
                    <i class="fas fa-check-circle"></i>
                    <h3>Vente complétée!</h3>
                </div>
                <div class="sale-notification-content">
                    <p>Monnaie à rendre:</p>
                    <div class="sale-notification-amount">${change.toFixed(2)}$</div>
        `;
        
        // Ajouter les informations sur les tickets si présents
        if (ticketItems.length > 0) {
            notificationContent += `
                    <hr style="margin: 15px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-weight: 600; margin-top: 15px;">Coupons vendus:</p>
            `;
            ticketItems.forEach(ticket => {
                notificationContent += `
                    <p style="font-size: 0.9rem; margin: 5px 0;">
                        ${ticket.ticketQuantity} coupon(s) - ${ticket.ticketEmail}<br>
                        <small style="color: #666;">Les numéros ont été envoyés par email</small>
                    </p>
                `;
            });
        }
        
        notificationContent += `
                </div>
                <button class="sale-notification-button">OK</button>
            </div>
        `;
        
        notification.innerHTML = notificationContent;
        document.body.appendChild(notification);

        // Gérer la fermeture de la notification
        const closeNotification = () => {
            notification.remove();
            // Réinitialiser le panier et les champs
            cart = [];
            currentCoupon = null;
            document.getElementById('amount-received').value = '';
            document.getElementById('change-amount').textContent = '0.00$';
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

// Fonction pour initialiser la modal coupon
function initCouponModal() {
    const modal = document.getElementById('coupon-modal');
    const form = document.getElementById('coupon-form');
    const closeBtn = modal?.querySelector('.close');
    
    // Gérer la soumission du formulaire avec Enter
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            applyCouponFromModal();
        });
    }
    
    // Fermer le modal avec le bouton X
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCouponModal);
    }
    
    // Fermer le modal en cliquant en dehors
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCouponModal();
            }
        });
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

        // Si on clique sur le coupon déjà actif, on le désactive
        if (currentCoupon && currentCoupon._id === coupon._id) {
            currentCoupon = null;
            // Réinitialiser les prix originaux
            cart.forEach(item => {
                item.discount = 0;
                item.price = item.product.price; // Utiliser le prix original du produit
            });
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
        
        updateCart();
    } catch (error) {
        console.error('Erreur lors de l\'application du coupon:', error);
        currentCoupon = null;
        
        // Réinitialiser les prix en cas d'erreur
        cart.forEach(item => {
            item.discount = 0;
            item.price = item.product.price;
        });
        updateCart();
        throw error; // Re-lancer l'erreur pour que la modal puisse l'afficher
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
            <img src="${(product.imageUrl || product.image || '/images/default-product.png')}" alt="${product.name}" onerror="this.src='/images/default-product.png'">
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