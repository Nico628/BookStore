class Store {
    constructor(serverUrl){
        this.serverUrl = serverUrl;
        this.stock = {};
        this.cart = [];
    }

    checkOut(onFinish) {
        this.syncWithServer((delta) => {
            console.log('checkout delta', delta)

            let msg = "";
            for (const itemName in delta) {
                for (const itemField in delta[itemName]) {
                    if(itemField === 'price' || itemField === 'quantity') {
                        if(delta[itemName][itemField] !== 0) {
                            let oldVal = this.stock[itemName][itemField] - delta[itemName][itemField]; // Minus the delta b/c stock has already been updated by updateStock()
                            let newVal = this.stock[itemName][itemField];
                            msg += itemField + ' of ' + this.stock[itemName].label + ' changed from ' + oldVal + ' to ' + newVal + '\n';
                        }                        
                    }
                }
            }

            if (msg === "") { // If delta contains no changes (proceed with checkout by alerting total price)
                // alert("Your total is: $" + this.getTotalCartPrice());
                var cartObj = {}
                for (const item in this.cart) {
                    cartObj[item] = this.cart[item]
                }

                let data = {
                    client_id: Math.floor((Math.random() * 10000) + 1).toString(),
                    cart: cartObj,
                    total: this.getTotalCartPrice()
                }

                ajaxPost(this.serverUrl + 'checkout', data, 
                    () => { // onSuccess
                        alert("Items were successfully checked out");
                        this.cart = [];
                        this.onUpdate();
                    },  
                    function() { // onError
                        alert("Failed to checkout");
                    });
            } else {
                alert(msg)
            }

        });
    
        if(onFinish !== undefined) {
            console.log('onFinish')
            onFinish();
        }
    }

    getTotalCartPrice() {
        let total = 0;

        console.log('getTOtalCartPrice', this.cart);

        for (const item in this.cart) {
            total += this.stock[item].price * this.cart[item];
        }

        return total;
    }

    // Re-render products and products page when updated
    onUpdate(itemName) {
        if (itemName === undefined) { // Re-render entire product list if itemName not given
            console.log('onUpdate empty case');
            renderProductList(document.querySelector('#productView'), store)
        } else {
            renderProduct(document.querySelector('#product-'+itemName),this, itemName);
        }
        renderCart(document.querySelector('#modal-content'), store);
        renderMenu(document.querySelector('#menuView'), store);
    }

    syncWithServer(onSync) {
        ajaxGet(this.serverUrl + "products",
            (response) => {
                console.log('currentStock',this.stock);
                console.log('response',response);
                let delta = findDelta(this.stock, this.cart, response);
                console.log('delta',delta);
                this.updateStock(delta);
                console.log('updatedStock', this.stock);
                this.onUpdate();
                if (onSync) {
                    console.log('onsync provided');
                    onSync(delta);
                }
            },
            (error) => {
                console.log('sync',error)
            }
        );
    }

    // Update the store stock given delta of changes (between current stock and response stock)
    updateStock(delta) { 
        if (Object.keys(this.stock).length === 0 && this.stock.constructor === Object) {
            this.stock = delta;
        } else {
            for (const itemName in delta) {
                for (const itemField in delta[itemName]) {
                    this.stock[itemName][itemField] += delta[itemName][itemField];
                }
            }
        }
    }

}

Store.prototype.addItemToCart = function(itemName) {
    // first, check availability in stock, decrement if yes
    if(this.stock[itemName].quantity <= 0) {
        alert("Sorry, Out of Stock!");
        return;
    }
    else {
        this.stock[itemName].quantity--;

    }

    // check if there is this item in cart
    if(itemName in this.cart === true) {
        this.cart[itemName]++;
    } else {
        this.cart[itemName] = 1;
    }
    this.onUpdate(itemName);
};

Store.prototype.removeItemFromCart = function(itemName) {
    // check if there is this item in cart
    if(itemName in this.cart === true) {
        if(this.cart[itemName]==1) { // quantity is 1, delete pair
            delete this.cart[itemName];
        } else {
            this.cart[itemName]--;
        }
    } else {
        alert("You have nothing in your cart!");
        return;
    }

    // increment stock
    this.stock[itemName].quantity++;
    this.onUpdate(itemName);
};

var showCart = function(store) {
    renderCart(document.querySelector('#modal-content'),store);
    showModal();
};

var store = new Store('http://localhost:3000/');
var displayed = [];

console.log(store);

// Find delta in price and quantity for each item between current store stock and the response stock
// NOTE: items in cart decrement store stock, so must be included to represent total stock 
// ASSUMES: there must be items in stock before there could be items in cart
function findDelta(storeInstanceStock, storeCart, responseStock) {
    let delta = {};

    // No items in stock
    if (Object.entries(storeInstanceStock).length === 0 && storeInstanceStock.constructor === Object) {
        console.log('initializeStock (findDelta)');
        delta = responseStock;
        return delta;
    }

    for (const itemName in responseStock) {
        delta[itemName] = {};
        delta[itemName].price = responseStock[itemName].price - storeInstanceStock[itemName].price;
        delta[itemName].quantity = responseStock[itemName].quantity - storeInstanceStock[itemName].quantity;

        if (storeCart[itemName] !== undefined) { // factor in cart quantity
            delta[itemName].quantity -= storeCart[itemName];
        }
    }
    return delta;
}


function ajaxGet(url, onSuccess, onError) {
    let retryCount = 3;
    let errorMsg = '';

    function getRequest() {
        if (retryCount > 0) {
            console.log('Remaining tries: ', retryCount);
            let xhr = new XMLHttpRequest();
            xhr.timeout = 2000;
            xhr.open("GET", url);
            xhr.send();

            xhr.onload = function() {  
                if (xhr.status == 200) { // OK, (success)
                    onSuccess(JSON.parse(xhr.responseText));
                } else {
                    retryCount--;
                    errorMsg = 'status not 200: ' + xhr.responseText;
                    getRequest();
                }
            }

            xhr.onerror = function() {
                retryCount--;
                errorMsg = 'onerror: ' + xhr.responseText;
                getRequest();
            }

            xhr.ontimeout = function() {
                console.log('ontimeout' + retryCount)
                retryCount--;
                errorMsg = 'ontimeout: ' + xhr.responseText;
                getRequest();
            }

        } else {
            onError(errorMsg); // After 3 failed attempts (error)
        }
    }

    getRequest();
}

function ajaxPost(url, data, onSuccess, onError) {
    let xhr = new XMLHttpRequest();
    xhr.timeout = 5000;
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.send(JSON.stringify(data));

    xhr.onload = function() {
        if (xhr.status == 200) { // OK, (success)
            onSuccess(JSON.parse(xhr.responseText));
        } 
    }

    xhr.onerror = function(e) {
        onError(e);
    }

    xhr.ontimeout = function(e) {
        onError(e);
    }
}

var inactiveTime = 0;

var interval = setInterval(increment, 60000);

function increment() {
    inactiveTime += 1;
    if(inactiveTime === 30) {
        alert("Hey there! Are you still planning to buy something?");
        inactiveTime = 0;
    }
}

function renderProduct(container, storeInstance, itemName) {
    //Remove all DOM nodes of container since we are replacing them
    clearContainer(container);

    const productImg = document.createElement('img');
    productImg.setAttribute('src', storeInstance.stock[itemName].imageUrl);
    container.appendChild(productImg);

    const productPriceDiv = document.createElement('div');
    productPriceDiv.setAttribute('class', 'productPrice');
    productPriceDiv.textContent = '$'+storeInstance.stock[itemName].price;
    container.appendChild(productPriceDiv);

    const productNameDiv = document.createElement('div');
    productNameDiv.setAttribute('class', 'productName');
    // productNameDiv.textContent = itemName;
    productNameDiv.textContent = storeInstance.stock[itemName].label;
    container.appendChild(productNameDiv);

    if(checkInStock(store, itemName)) {
        const addItemButton = document.createElement('button');
        addItemButton.setAttribute('class', 'btn-add');
        addItemButton.setAttribute('onclick', "store.addItemToCart('"+itemName+"');inactiveTime=0;");
        const addText = document.createTextNode('Add');
        addItemButton.appendChild(addText);
        container.appendChild(addItemButton);
    }

    if(checkInCart(store, itemName)) {
        const removeItemButton = document.createElement('button');
        removeItemButton.setAttribute('class', 'btn-remove');
        removeItemButton.setAttribute('onclick', "store.removeItemFromCart('"+itemName+"');inactiveTime=0;");
        const removeText = document.createTextNode('Remove');
        removeItemButton.appendChild(removeText);
        container.appendChild(removeItemButton);
    } 
}

function checkInStock(store, itemName) {
    return (store.stock[itemName] && store.stock[itemName].quantity > 0);
}

function checkInCart(store, itemName) {
    return (store.cart[itemName] && store.cart[itemName] > 0);
}

function clearContainer(container) {
    while (container.firstChild) {
        container.removeChild(container.firstChild);
        // console.log('removed child')
    }
}

function renderProductList(container, storeInstance) {
    //Remove all DOM nodes of container since we are replacing them
    clearContainer(container);

    const productList = document.createElement('ul');
    productList.setAttribute('id', 'productList');

    // for (const itemName in storeInstance.stock) {
    //     const product = document.createElement('li');
    //     product.setAttribute('class', 'product');
    //     product.setAttribute('id', 'product-'+itemName);   
    //     renderProduct(product, storeInstance, itemName);
    //     productList.appendChild(product);
    // }

    for (const itemName of displayed) {
        const product = document.createElement('li');
        product.setAttribute('class', 'product');
        product.setAttribute('id', 'product-'+itemName);   
        renderProduct(product, storeInstance, itemName);
        productList.appendChild(product);
    }
    container.appendChild(productList);
}

renderProductList(document.querySelector('#productView'), store)

function hideModal() {
    // document.querySelector('#modal').style.display = 'none';
    document.querySelector('#modal').style.visibility = 'hidden';
}
function showModal() {
    // document.querySelector('#modal').style.display = 'block';
    document.querySelector('#modal').style.visibility = 'visible';
}

function hideCart() {
    hideModal();
}

//Hide the modal initially
hideModal();

//Render the cart modal
function renderCart(container, storeInstance) {
    clearContainer(container);    

    let renderCartTotalPrice = 0;
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    const theadtr = document.createElement('tr');
    const ttitle = document.createElement('th');
    ttitle.setAttribute('colspan', 4);
    ttitle.textContent = 'Cart';
    theadtr.appendChild(ttitle);
    thead.appendChild(theadtr);

    const tbody = document.createElement('tbody');
    const tbodytr = document.createElement('tr');
    const tbodydescr1 = document.createElement('td');
    tbodydescr1.textContent = 'Item Name';
    const tbodydescr2 = document.createElement('td');
    tbodydescr2.textContent = 'Quantity';
    const tbodydescr3 = document.createElement('td');
    tbodydescr3.textContent = 'Price';
    const tbodydescr4 = document.createElement('td');
    tbodydescr4.textContent = 'Add/Remove';
    tbodytr.appendChild(tbodydescr1);
    tbodytr.appendChild(tbodydescr2);
    tbodytr.appendChild(tbodydescr3);
    tbodytr.appendChild(tbodydescr4);
    tbody.appendChild(tbodytr);

    for(var itemName in storeInstance.cart) {
        const itemTableRow = document.createElement('tr');
        const itemNameTd = document.createElement('td');
        itemNameTd.textContent = itemName;
        const itemQuanTd = document.createElement('td');
        itemQuanTd.textContent = storeInstance.cart[itemName]
        const itemPriceTd = document.createElement('td');
        itemPriceTd.textContent = '$' + storeInstance.cart[itemName] * storeInstance.stock[itemName].price;
    
        renderCartTotalPrice += storeInstance.cart[itemName] * storeInstance.stock[itemName].price;

        const itemAddRemoveTd = document.createElement('td');

        //Create '+' button
        const addItemButton = document.createElement('button');
        addItemButton.setAttribute('onclick', "store.addItemToCart('"+itemName+"');inactiveTime=0;");
        const addText = document.createTextNode('+');
        addItemButton.appendChild(addText);
        itemAddRemoveTd.appendChild(addItemButton);
        
        //Create '-' button
        const removeItemButton = document.createElement('button');
        removeItemButton.setAttribute('onclick', "store.removeItemFromCart('"+itemName+"');inactiveTime=0;");
        const removeText = document.createTextNode('-');
        removeItemButton.appendChild(removeText);
        itemAddRemoveTd.appendChild(removeItemButton);

        itemTableRow.appendChild(itemNameTd);
        itemTableRow.appendChild(itemQuanTd);
        itemTableRow.appendChild(itemPriceTd);
        itemTableRow.appendChild(itemAddRemoveTd);
        tbody.appendChild(itemTableRow);
    }

    //Row containing total price
    const blankRow = document.createElement('tr');
    const totalPriceRow = document.createElement('tr');
    const totalTextTd = document.createElement('td');
    totalTextTd.textContent = 'Total Price:'
    totalTextTd.style.fontWeight = "bold";
    totalTextTd.setAttribute('colspan',3)

    const totalPriceTd = document.createElement('td');
    totalPriceTd.textContent = '$'+renderCartTotalPrice;
    totalPriceTd.style.fontWeight = "bold";
    totalPriceRow.appendChild(totalTextTd);

    totalPriceRow.appendChild(totalPriceTd);
    tbody.appendChild(blankRow);
    tbody.appendChild(totalPriceRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
}

//Hide modal on esc key press
document.onkeydown = function(evt) {
    evt = evt || window.event;
    if (evt.keyCode == 27) {
        hideModal();
    }
};

store.syncWithServer(function(delta) {
    console.log('syncw', delta)
    for (itemName in delta) {
        displayed.push(itemName);
    }

    renderProductList(document.querySelector('#productView'), store);
});

document.getElementById("btn-check-out").onclick = function() {
    this.disabled = true;
    store.checkOut(() => {
        console.log('finish', this);
        this.disabled = false;});
}

Store.prototype.queryProducts = function(query, callback){
	var self = this;
	var queryString = Object.keys(query).reduce(function(acc, key){
			return acc + (query[key] ? ((acc ? '&':'') + key + '=' + query[key]) : '');
		}, '');
	ajaxGet(this.serverUrl+"products?"+queryString,
		function(products){
			Object.keys(products)
				.forEach(function(itemName){
					var rem = products[itemName].quantity - (self.cart[itemName] || 0);
					if (rem >= 0){
						self.stock[itemName].quantity = rem;
					}
					else {
						self.stock[itemName].quantity = 0;
						self.cart[itemName] = products[itemName].quantity;
						if (self.cart[itemName] === 0) delete self.cart[itemName];
					}
					
					self.stock[itemName] = Object.assign(self.stock[itemName], {
						price: products[itemName].price,
						label: products[itemName].label,
						imageUrl: products[itemName].imageUrl
					});
				});
			self.onUpdate();
			callback(null, products);
		},
		function(error){
			callback(error);
		}
	)
}

function renderMenu(container, storeInstance){
	while (container.lastChild) container.removeChild(container.lastChild);
	if (!container._filters) {
		container._filters = {
			minPrice: null,
			maxPrice: null,
			category: ''
		};
		container._refresh = function(){
			storeInstance.queryProducts(container._filters, function(err, products){
					if (err){
						alert('Error occurred trying to query products');
						console.log(err);
					}
					else {
						displayed = Object.keys(products);
						renderProductList(document.getElementById('productView'), storeInstance);
					}
				});
		}
	}

	var box = document.createElement('div'); container.appendChild(box);
		box.id = 'price-filter';
		var input = document.createElement('input'); box.appendChild(input);
			input.type = 'number';
			input.value = container._filters.minPrice;
			input.min = 0;
			input.placeholder = 'Min Price';
			input.addEventListener('blur', function(event){
				container._filters.minPrice = event.target.value;
				container._refresh();
			});

		input = document.createElement('input'); box.appendChild(input);
			input.type = 'number';
			input.value = container._filters.maxPrice;
			input.min = 0;
			input.placeholder = 'Max Price';
			input.addEventListener('blur', function(event){
				container._filters.maxPrice = event.target.value;
				container._refresh();
			});

	var list = document.createElement('ul'); container.appendChild(list);
		list.id = 'menu';
		var listItem = document.createElement('li'); list.appendChild(listItem);
			listItem.className = 'menuItem' + (container._filters.category === '' ? ' active': '');
			listItem.appendChild(document.createTextNode('All Items'));
			listItem.addEventListener('click', function(event){
				container._filters.category = '';
				container._refresh()
			});
	var CATEGORIES = [ 'Clothing', 'Technology', 'Office', 'Outdoor' ];
	for (var i in CATEGORIES){
		var listItem = document.createElement('li'); list.appendChild(listItem);
			listItem.className = 'menuItem' + (container._filters.category === CATEGORIES[i] ? ' active': '');
			listItem.appendChild(document.createTextNode(CATEGORIES[i]));
			listItem.addEventListener('click', (function(i){
				return function(event){
					container._filters.category = CATEGORIES[i];
					container._refresh();
				}
			})(i));
	}
}