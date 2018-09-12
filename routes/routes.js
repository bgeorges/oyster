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

var publicConfig = {
    key: '<YOUR-KEY>',
    stagger_time:       1000, // for elevationPath
    encode_polylines:   false,
    secure:             true, // use https
    proxy:              'http://127.0.0.1:9999' // optional, set a proxy for HTTP requests
  };
  var gmAPI = new GoogleMapsAPI(publicConfig);

  // reverse geocode API
var reverseGeocodeParams = {
    "latlng":        "51.1245,-0.0523",
    "result_type":   "postal_code",
    "language":      "en",
    "location_type": "APPROXIMATE"
  };
  
  gmAPI.reverseGeocode(reverseGeocodeParams, function(err, result){
    console.log(result);
  });
module.exports = appRouter;
