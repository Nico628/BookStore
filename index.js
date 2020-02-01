// Require dependencies
var path = require('path');
var express = require('express');
var StoreDB = require('./StoreDB.js');

var db = StoreDB('mongodb://127.0.0.1:27017','cpen400a-bookstore');

// Declare application parameters
var PORT = process.env.PORT || 3000;
var STATIC_ROOT = path.resolve(__dirname, './public');

// Defining CORS middleware to enable CORS.
// (should really be using "express-cors",
// but this function is provided to show what is really going on when we say "we enable CORS")
function cors(req, res, next){
    res.header("Access-Control-Allow-Origin", "*");
  	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  	res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS,PUT");
  	next();
}

// Instantiate an express.js application
var app = express();

// Configure the app to use a bunch of middlewares
app.use(express.json());							// handles JSON payload
app.use(express.urlencoded({ extended : true }));	// handles URL encoded payload
app.use(cors);										// Enable CORS

app.use('/', express.static(STATIC_ROOT));			// Serve STATIC_ROOT at URL "/" as a static resource

// Configure '/products' endpoint
app.get('/products', function(request, response) {
	db.getProducts(request.query).then(products => {
			// console.log('appGet', products)
			response.send(products);
		}
	).catch(error => {
		response.status("200").send(error);
	}) 
});

app.post("/checkout", function(request, response) {
	// console.log('checkoutReq', request);
	let order = request.body;
	console.log('checkoutBody', order);

	//Sanitize order (field and type checks)
	if (order.hasOwnProperty("client_id") && typeof order.client_id == "string" &&
		order.hasOwnProperty("cart") && typeof order.cart == "object" &&
		order.hasOwnProperty("total") && typeof order.total == "number") {
			
		db.addOrder(request.body)
		.then((resolveId) => {
			response.json( { id: resolveId } );
		})
		.catch(error => {
			response.status("500").send(error);
		});
	} else {
		response.status("500").send(error);
	}
})

// Start listening on TCP port
app.listen(PORT, function(){
    console.log('Express.js server started, listening on PORT '+PORT);
});