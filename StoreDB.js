var MongoClient = require('mongodb').MongoClient;	// require the mongodb driver

/**
 * Uses mongodb v3.1.9 - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.1/api/)
 * StoreDB wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our bookstore app.
 */
function StoreDB(mongoUrl, dbName){
	if (!(this instanceof StoreDB)) return new StoreDB(mongoUrl, dbName);
	this.connected = new Promise(function(resolve, reject){
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			function(err, client){
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to '+mongoUrl+'/'+dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
}


StoreDB.prototype.getProducts = function(queryParams){
	console.log('qp', queryParams)
	let query = { $and: [] };

	// Optional query fields, AND each of them if specified
	if (queryParams.hasOwnProperty("minPrice")) {
		query.$and.push( {price: {$gte : parseInt(queryParams.minPrice) }});
	}
	if (queryParams.hasOwnProperty("maxPrice")) {
		query.$and.push ( {price: {$lte : parseInt(queryParams.maxPrice) }});
	}
	if (queryParams.hasOwnProperty("category")) {
		query.$and.push( {category : queryParams.category});
	}

	// console.log('q', query.$and)

	return this.connected.then(function(db){
		return new Promise(function (resolve, reject) {
			var productsAsObj = {};

			db.collection("products").find(query.$and.length > 0 ? query : {}).toArray(function (err, result) {
				if (err) {
					console.log("getProducts promise err", err);
					reject(err);
				} else {
					// console.log("getProducts promise result", result);
					// Requirement: resolve as object instead of array (result is array)
					result.forEach(prod => {
						productsAsObj[prod._id] = {
							label: prod.label,
							price: prod.price,
							quantity: prod.quantity,
							imageUrl: prod.imageUrl
							//omitting category
						}
					});
					resolve(productsAsObj);
				}
			})
		})
	})
}

StoreDB.prototype.addOrder = function(order){
	console.log('addOrder', order)
	return this.connected.then(function(db){
		return new Promise(function (resolve, reject) {
			
		//Sanitize order (field and type checks)
		if (order.hasOwnProperty("client_id") && typeof order.client_id == "string" &&
			order.hasOwnProperty("cart") && typeof order.cart == "object" &&
			order.hasOwnProperty("total") && typeof order.total == "number") {			

			db.collection("orders").insertOne(order).then(result => {
				// Decrement in products collection
				for (item in order.cart) {
					db.collection("products").updateOne(
						{ _id: item }, 
						{ 
							$inc: { quantity: -order.cart[item] }
						}
					 )
				}
				resolve(result.insertedId);
			}).catch(err => {
				reject(err);
			})
		} else {
			reject("Order not sanitized");
		}
		})
	})
}

module.exports = StoreDB;