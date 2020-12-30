var express = require('express');
var router = express.Router();


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { env:  req.app.get('env')});
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
  // res.sendFile(__dirname + '/../node_modules/json/' + req.params.filename + '.json');
})

module.exports = router;
