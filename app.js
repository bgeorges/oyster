var express = require("express");
var bodyParser = require("body-parser");
var app = express();

var port = 8080;

console.log("Server starting Port %d", port)

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var routes = require("./routes/routes.js")(app);

var server = app.listen(port, function () {
    console.log("Listening on port %s...", server.address().port);
});


