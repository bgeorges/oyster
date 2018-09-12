var express = require('express');
var router = express.Router();
var parser = require('../PayloadParser');

/* GET Parse Usage. */
router.get('/', function(req, res, next) {
    res.send('Empty JSON response');
  });

/* Parse payload data */
router.get("/:data", function (req, res, next) {
    var data = req.params.data;
    var results = parser.parseSigFox(data);
    console.log("Lat: %d, Lon: %d",results.Latitude, results.Longitude);
    res.json(results);
});


module.exports = router;