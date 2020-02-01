var Store = function(serverUrl) {
    this.serverUrl = serverUrl;
    this.stock = {};
    this.cart = [];
    this.onUpdate = null
    this.syncWithServer = null;
    this.checkOut = null;
};

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

// var products = {Box1: {label:"Box 1", imageUrl:"./images/Box1_$10.png", price:10, quantity:5 },
//                 Box2: {label:"Box 2", imageUrl:"./images/Box2_$5.png", price:5 , quantity:5 },
//                 Clothes1: {label:"Clothes 1", imageUrl:"./images/Clothes1_$20.png", price:20 , quantity:5 },
//                 Clothes2: {label:"Clothes 2", imageUrl:"./images/Clothes2_$30.png", price:30 , quantity:5 },
//                 Jeans: {label:"Jeans", imageUrl:"./images/Jeans_$50.png", price:50 , quantity:5 },
//                 Keyboard: {label:"Keyboard", imageUrl:"./images/Keyboard_$20.png", price:20 , quantity:5 },
//                 KeyboardCombo: {label:"Keyboard Combo", imageUrl:"./images/Keyboard_$20.png", price:20 , quantity:5 },
//                 Mice: {label:"Mice", imageUrl:"./images/Mice_$20.png", price:20 , quantity:5 },
//                 PC1: {label:"PC 1", imageUrl:"./images/PC1_$350.png", price:350 , quantity:5 },
//                 PC2: {label:"PC 2", imageUrl:"./images/PC2_$400.png", price:400 , quantity:5 },
//                 PC3: {label:"PC 3", imageUrl:"./images/PC3_$300.png", price:300 , quantity:5 },
//                 Tent: {label:"Tent", imageUrl:"./images/Tent_$100.png", price:100 , quantity:5 }
//             };

// var store = new Store(products);
var store = new Store('https://cpen400a-bookstore.herokuapp.com');
var totalPriceAmount = 0;

// store.stock = products;

store.checkOut = function(onFinish) {
    console.log('checkout delta', delta)
    store.syncWithServer(function(delta) {
        if(Object.keys(delta).length === 0 && delta.constructor === Object) { // If delta is empty, proceed with checkout
            alert("Your total is: $" + totalPriceAmount);
        }
        else {
            let msg = "";
            for (itemName in delta) {
                for (itemField in delta[itemName]) {
                    if(itemField === 'price' || itemField === 'quantity') {
                        let oldVal = store.stock[itemName][itemField];
                        let newVal = delta[itemName][itemField] + oldVal;

                        msg += itemField + ' of ' + store.stock[itemName].label + ' changed from ' + oldVal + ' to ' + newVal + '\n';
                    }
                }
                
            }
            alert(msg);
        }
    });

    if(onFinish !== undefined) {
        console.log('onFinish')
        onFinish();
        
    }
}

// Re-render products and products page when updated
store.onUpdate = function(itemName) {
    if (itemName === undefined) { // Re-render entire product list if itemName not given
        console.log('onUpdate empty case');
        renderProductList(document.querySelector('#productView'), store)
    } else {
        renderProduct(document.querySelector('#product-'+itemName),this, itemName);
    }
    renderCart(document.querySelector('#modal-content'), store);
}

store.syncWithServer = function(onSync) {
    ajaxGet(this.serverUrl + "/products",
        function(response) {
            let delta = findDelta(store.stock, response);
            console.log('delta',delta);
            updateStock(store.stock, delta);
            store.onUpdate();
            if (onSync) {
                console.log('onsync provided');
                onSync(delta);
            }
        },
        function(error) {
            console.log('sync',error)
        }
    );
}

// Deep compare stock and response object for differences
// Assumes that itemName in stock and response instances are unique
// Assumes that storeInstance and responseInstance could be different sizes
function findDelta(storeInstanceStock, responseStock) {
    console.log('currentStock',storeInstanceStock);
    console.log('response',responseStock);
    let delta = {};
    
    // Check for differences in direction: store -> response
    for (itemName in storeInstanceStock) {
        if (responseStock.hasOwnProperty(itemName)) {
            let currStoreItem = storeInstanceStock[itemName];
            for (itemField in currStoreItem) {
                let currStoreItemField = currStoreItem[itemField];
                let currRespItemField = responseStock[itemName][itemField];
                if (currStoreItemField !== currRespItemField) {
                    if(!delta.hasOwnProperty(itemName)) {
                        delta[itemName] = {};
                    }
                    if(itemField === 'price' || itemField === 'quantity') {
                        // Calculate the difference between the store and response instance (number quanitity)
                        let diffVal =  currRespItemField -  currStoreItemField;
                        delta[itemName][itemField] = diffVal;
                    } else {
                        delta[itemName][itemField] = currRespItemField;
                    }
                }
            }
        } else {
            delta[itemName] = storeInstanceStock[itemName];
        }
    }

    //Check in direction: response -> stock 
    for (itemName in responseStock) {
        if(!delta.hasOwnProperty(itemName)) {
            delta[itemName] = responseStock[itemName];
        }
    }

    return delta;
}

// Update the store stock given delta of changes (between current stock and response stock)
function updateStock(storeInstanceStock, delta) { 
    for (itemName in delta) {
        let currDeltaItem = delta[itemName];

        if(!storeInstanceStock.hasOwnProperty(itemName)) {
            storeInstanceStock[itemName] = currDeltaItem;
        } else {
            for (itemField in currDeltaItem) {
                if(itemField === 'price' || itemField === 'quantity') {
                    // console.log('updating', currDeltaItem[itemField])
                    storeInstanceStock[itemName][itemField] += currDeltaItem[itemField];
                } else {
                    storeInstanceStock[itemName][itemField] = currDeltaItem[itemField];
                }
            }
        }
    }

    console.log('updatedStock', storeInstanceStock)
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
        console.log('removed child')
    }
}

function renderProductList(container, storeInstance) {
    //Remove all DOM nodes of container since we are replacing them
    clearContainer(container);

    const productList = document.createElement('ul');
    productList.setAttribute('id', 'productList');

    for (var itemName in storeInstance.stock) {
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

    totalPriceAmount = 0;
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
    
        totalPriceAmount += storeInstance.cart[itemName] * storeInstance.stock[itemName].price;

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
    totalPriceTd.textContent = '$'+totalPriceAmount;
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

store.syncWithServer();


function checkOutAction() {
    let checkOutButton = document.getElementById("btn-check-out");

    checkOutButton.disabled = true;
    store.checkOut(() => {
        console.log('finish', this);
        checkOutButton.disabled = false;});
}


// document.getElementById("btn-check-out").onclick = function() {
//     this.disabled = true;
//     store.checkOut(() => {
//         console.log('finish', this);
//         this.disabled = false;});
// }