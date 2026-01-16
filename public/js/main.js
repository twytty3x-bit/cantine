let cart = [];

document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
    setupCartToggle();
    setupSearch();
});

async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
    }
}

function displayProducts(products) {
    const container = document.getElementById('products-container');
    container.innerHTML = '';

    products.forEach(product => {
        const button = createProductButton(product);
        container.appendChild(button);
    });
}

function createProductButton(product) {
    const button = document.createElement('button');
    button.className = 'product-button';
    button.disabled = product.stock <= 0;
    button.onclick = () => addToCart(product._id);

    button.innerHTML = `
        <div class="product-name">${product.name}</div>
        <div class="product-price">${product.price.toFixed(2)}$</div>
        <div class="product-stock">
            ${product.stock > 0 ? `Stock: ${product.stock}` : 'Rupture de stock'}
        </div>
    `;

    return button;
}

function addToCart(productId) {
    fetch(`/api/products/${productId}`)
        .then(response => response.json())
        .then(product => {
            const existingItem = cart.find(item => item.id === productId);
            
            if (existingItem) {
                if (existingItem.quantity < product.stock) {
                    existingItem.quantity++;
                    updateCartDisplay();
                } else {
                    alert('Stock insuffisant');
                }
            } else {
                if (product.stock > 0) {
                    cart.push({
                        id: productId,
                        name: product.name,
                        price: product.price,
                        quantity: 1,
                        maxStock: product.stock
                    });
                    updateCartDisplay();
                }
            }
        });
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const cartCount = document.querySelector('.cart-count');
    
    cartItems.innerHTML = '';
    let total = 0;
    let count = 0;

    cart.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price.toFixed(2)}$</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)" 
                        ${item.quantity >= item.maxStock ? 'disabled' : ''}>+</button>
            </div>
            <button class="remove-btn" onclick="removeFromCart('${item.id}')">
                <i class="fas fa-trash"></i>
            </button>
        `;
        cartItems.appendChild(itemElement);
        total += item.price * item.quantity;
        count += item.quantity;
    });

    cartTotal.textContent = `Total: ${total.toFixed(2)}$`;
    cartCount.textContent = count;
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        const newQuantity = item.quantity + change;
        if (newQuantity > 0 && newQuantity <= item.maxStock) {
            item.quantity = newQuantity;
            updateCartDisplay();
        }
    }
}

function removeFromCart(productId) {
    const index = cart.findIndex(item => item.id === productId);
    if (index > -1) {
        cart.splice(index, 1);
        updateCartDisplay();
    }
}

function setupCartToggle() {
    const cartToggle = document.getElementById('cart-toggle');
    const cartElement = document.getElementById('panier');
    
    cartToggle.addEventListener('click', (e) => {
        e.preventDefault();
        cartElement.classList.toggle('visible');
    });
}

function setupSearch() {
    const searchInput = document.querySelector('.search-box input');
    const searchButton = document.querySelector('.search-box button');

    async function performSearch() {
        const query = searchInput.value.trim();
        if (query.length > 0) {
            try {
                const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
                const products = await response.json();
                displayProducts(products);
            } catch (error) {
                console.error('Erreur de recherche:', error);
            }
        } else {
            loadProducts();
        }
    }

    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    searchButton.addEventListener('click', performSearch);
}

// Ajoutons des styles supplémentaires pour le nouveau design 