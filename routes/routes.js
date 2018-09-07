var parser = require('../lib/PayLoadParser.js');
var mockData = "003165c700e703ec3d0000b0";

var appRouter = function (app) {

    app.get("/", function (req, res) {
        res.status(200).send("For Usage see: ");
    });

    app.get("/parse/:data", function(req,res, next){
        var data = req.params.data;
        var results = parser.parseSigFox(data);
        console.log(results);
        res.json(results);
    });

}

module.exports = appRouter;
