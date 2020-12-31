var express = require('express');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { env:  req.app.get('env')});
});

router.get('/globe', function(req, res, next) {
  res.render('globe', { env:  req.app.get('env')});
});

router.get('/geodata/json/:filename([a-z]+Low).json', function(req, res, next){
  var options = {
    root: __dirname + '/../node_modules/@amcharts/amcharts4-geodata/json/',
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  }
  res.sendFile(req.params.filename + '.json', options);
})

router.get('/geodata/json/data/countries2.json', function(req, res, next){
  var options = {
    root: __dirname + '/../node_modules/@amcharts/amcharts4-geodata/json/data',
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  }
  res.sendFile('countries2.json', options);
})


module.exports = router;
