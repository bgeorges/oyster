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
    var results;
    try {
        results = parser.parseSigFox(data);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
    if (!results) {
        return res.status(400).json({ error: 'Unknown or unsupported record type' });
    }
    console.log("Lat: %d, Lon: %d", results.Latitude, results.Longitude);
    res.json(results);
});


module.exports = router;
